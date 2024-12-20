---
title: '虚拟化技术：AMD SVM Hypervisor'
description: '基于 rvm 适配 AMD SVM 的 Hypervisor'
date: '2024-12-20 21:01:12'
tags: ['rust', 'os', 'hypervisor']
author: '寒冰'
---

本文是基于 https://github.com/equation314/RVM-Tutorial 做的 AMD SVM 适配，尽可能展示相关代码，但限于篇幅不会完全贴入代码。以及参考了 https://web.archive.org/web/20220815132158/https://key08.com/index.php/2021/04/11/1004.html 和 https://web.archive.org/web/20241008083327/https://blog.back.engineering/04/08/2022/，感谢前辈详细的文章。

若无特殊说明，文中提及的页数均依据 2024 版本。下称 “手册”，使用 “手册 xx 页” 标注页面，作为补充下方链接还包括一份旧版本的 AMD 虚拟化技术的独立文档。本文汇编代码均使用 nasm 格式或 Rust 内联汇编。

- (24593—Rev. 3.42—March 2024) AMD64 Architecture Programmer’s Manual Volumes 1–5 https://web.archive.org/web/20241114034725/https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/40332.pdf
- (33047–Rev. 3.02–December 2005) AMD64 Virtualization Technology Secure Virtual Machine Architecture Reference Manual https://web.archive.org/web/20240828193507/http://www.0x04.net/doc/amd/33047.pdf

## 检查本机是否支持虚拟化技术

在 AMD 中，虚拟化技术指令集名称为 SVM，与 Intel VT-x 的 VMX 类似，但在细节上有所不同。

据手册 955 页描述，在开启虚拟化支持前需要先进行检查：

1. 检查 CPUID 功能号 Fn 8000_0001 的 ECX[SVM] 位为 1
2. VM CR 寄存器的 SVMDIS 位为 0（如果 CPU 支持 SVM，但 BIOS 中有对虚拟化技术的限制这一个为 1）

然后通过将 EFER.SVME 设置为 1 即可开启虚拟化功能。

### CPUID 与 SVM 特性

> 通过 CPUID 指令，可以从 CPU 中查询 CPU 支持的特性、CPU 厂商信息等。直接调用 cpuid 指令（eax = 0x0000_0000）会返回 CPU 的字符串标识符，这个标识符将拆分存放在 ebx、ecx、edx 中（在 Intel 通常是 GenuineIntel，AMD 通常是 AuthenticAMD）。通过改变 eax 的值，cpuid 将返回不同的内容。

Fn 8000_0001 传参给 ECX 寄存器的位说明在手册 1894 页，查看表 CPUID Fn8000_0001_ECX Feature Identifiers，看到 SVM 位会被 CPUID 放置在 ECX 的第三个位（index 2）。

因此我们要做的操作如下：

```nasm
mov eax, 0x80000001
cpuid
```

但是在 rust 的 asm 中还需要 [处理与 LLVM 相关的部分](https://course.rs/advance/unsafe/inline-asm.html#clobbered-寄存器)，因此为了简单起见，我们使用 [x86](https://github.com/gz/rust-x86) 库对 cpuid 进行读取。

```rust
// asm! 写法
fn get_cpuid_80000001_ecx() -> u32 {
    let mut ecx: u32;

    unsafe {
        asm!(
            "cpuid", 
            inout("eax") 0x80000001u32 => _,
            out("ecx") ecx,
            options(nostack, preserves_flags)
        );
    }

    ecx
}

// 使用 x86::cpuid
let cpuid = x86::cpuid::CpuIdResult::from(x86::cpuid::cpuid!(0x80000001));
let ecx = cpuid.ecx;

// 然后读取 svm 位即可
let svm = cpuid.ecx & (1 << 2);

info!("[RVM] CPUID: {:#x}, SVM Feature: {:#?}", ecx, svm != 0);
if svm == 0 {
    return rvm_err!(Unsupported, "CPU does not support feature SVM");
}
```

### VM CR

VM CR 的描述位于手册 1039 页，SVMDIS 在第五位（index 4）。

VM CR 也需要使用指令获取，rust 的 asm 代码如下：

```rust
pub fn read_msr(msr: u32) -> u64 {
    let mut low: u32;
    let mut high: u32;

    unsafe {
        asm!(
            "rdmsr",
            in("ecx") msr,
            out("eax") low,
            out("edx") high,
        );
    }

    ((high as u64) << 32) | (low as u64)
}

// 获取
let msr_value = read_msr(0xC0010114);
let svm_disabled = msr_value & (1 << 4);

info!("[RVM] VM_CR register value: {:#x}, SVM Enabled: {:?}", msr_value, svm_disabled == 0);
if svm_disabled != 0 {
    return rvm_err!(ResourceBusy, "SVM is not enabled in VM_CR register");
}
```

### 开启 EFER.SVME

![efer](https://ice.frostsky.com/2024/12/20/fbf343ec8ee5d0a1893daacf99dc4f94.png)

EFER 同样也是一种 MSR 寄存器：

```rust
pub fn enable_svm() {
    let mut low: u32;
    let mut high: u32;

    unsafe {
        asm!(
            "rdmsr",
            in("ecx") 0xC0000080u32,
            out("eax") low,
            out("edx") high,
        );
    }

    low |= 1 << 12;
    
    unsafe {
        asm!(
            "wrmsr",
            in("ecx") 0xC0000080u32,
            in("eax") low,
            in("edx") high,
        );
    }
}
```

## 切换到虚拟化环境

为了切换进虚拟化环境，我们需要让原先 CPU 寄存器的数据先被保存在某个区域，然后使用 vmrun 进入虚拟化环境。而保存和恢复 CPU 寄存器的工作将由 CPU 自行完成，在 AMD 中，我们只需要开辟一片用于保存当前 CPU 的内存页并设置 VM_HSAVE_PA MSR 即可。

> 手册 957 页：
>
> Processor implementations may store only part or none of host state in the memory area pointed to by VM_HSAVE_PA MSR and may store some or all host state in hidden on-chip memory. Different implementations may choose to save the hidden parts of the host’s segment registers as well as the selectors. For these reasons, software must not rely on the format or contents of the host state save area, nor attempt to change host state by modifying the contents of the host save area.
>
> 明确指出，vmm 程序不应该依赖特定的主机状态保存顺序来修改这些数据。这点与 intel 不同，在 intel 的 vmx 中，需要 vmm 对主机状态进行保存。

### 初始化与加载 VMCB

### 设置退出条件

当我们用 vmrun 切换进虚拟化环境之后，

### VMRUN

那么… vmrun？

![gp#0](https://ice.frostsky.com/2024/12/20/2921999a10415f1ae73683ef2a25ddc3.png)

这是怎么回事呢？我们返回手册，手册 956 页，在 15.5 VMRUN Instruction 的 15.5.1 Basic Operation 节有一句：

> VMRUN is available only at CPL 0. A #GP(0) exception is raised if the CPL is greater than 0.

再结合 log 的 error，是一个 error code 为 0 的 #GP。是不是 CPL 不为 0 导致了这个问题出现呢？

![trap](https://ice.frostsky.com/2024/12/20/e7e75dcbabfa70afd5ff816c33dbd272.png)

1. CS 为 0x8，也就是 0b1000，低两位为 00，那么说明执行指令时特权级是 0。