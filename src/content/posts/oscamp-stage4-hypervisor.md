---
title: 'oscamp：操作系统虚拟化'
description: 'oscamp：操作系统虚拟化'
date: '2024-12-20 21:01:12'
tags: ['rust', 'os', 'hypervisor']
author: '寒冰'
---

> 跪了，开发环境好麻烦哦！！！

是 OS 训练营阶段四（以前的阶段三）的虚拟化任务，借此机会来学习虚拟化相关的知识。

## 开发环境

我的开发环境是位于 PVE 中的虚拟机，所以如果需要虚拟机也支持 vmx 技术就需要在 PVE 上打开嵌套虚拟化。

> Windows 同理，且虚拟化技术至少需要从 BIOS 打开虚拟化支持，Windows 平台中打开任务管理器切换到 CPU 详细页右下角就可以看到支持信息。WSL 本质是虚拟机，因此如果是在 WSL 中进行开发也需要打开嵌套虚拟化。
> 

在虚拟机中使用 `grep "vmx|svm" /proc/cpuinfo` 如果有输出则说明已经启用了嵌套虚拟化。

```rust
# INTEL
modprobe -r kvm_intel 
modprobe kvm_intel nested=1
# 这句是添加到启动时也同时加载模块，amd 也同样是这样
echo "options kvm_intel nested=1" >> /etc/modprobe.d/modprobe.conf

# AMD
modprobe -r kvm_amd
modprobe kvm_amd nested=1
echo "options kvm_amd nested=1" >> /etc/modprobe.d/modprobe.conf
```

> 其实就这两条指令，但是 PVE 需要关闭了全部 kvm 虚拟机才可以进行操作。而我的 PVE 里同时还有软路由虚拟机（？），如果关闭了它意味着我无法通过网络连接到机器上。
> 

完成后使用 `cat /sys/module/kvm_intel/parameters/nested` 查询 PVE 是否已经打开嵌套虚拟化。输出结果可能会是 `1` 或者 `Y` 。

## AMD 不嘻嘻

![umhv not support amd](https://ice.frostsky.com/2024/12/20/f1a65c14ba02e762daeb033a14b61fb3.png)

根据 arceos-hypervisor 社区成员的反馈，arceos-umhv 暂时还不支持 AMD 平台。😣😣😣 

且我换用 Intel 的 WIndows 机器也不可以，我猜这和 Windows 的内核保护有关。

![hv](https://ice.frostsky.com/2024/12/20/5dd8d429315e87e05ac04e30a5a41fa6.png)

AMD 不嘻嘻，Intel 也没好哪里去！

考虑到关闭 Windows 内核保护在我本机容易引起蓝屏 + 不方便在教室里写代码，尝试使用 bochs 模拟器对 vmx 进行模拟和尝试写一写 AMD svm 的兼容代码。

## 在 Bochs 中全仿真 vmx

```bash
# 在 umhv 中使用 make 直接进行编译
$ make

# 产生文件
# ./arceos-umhv/arceos-vmm/arceos-vmm_x86_64-qemu-q35.elf
# ./arceos-umhv/arceos-vmm/arceos-vmm_x86_64-qemu-q35.bin
# ./arceos-umhv/arceos-vmm/arceos-vmm_x86_64-qemu-q35.asm

# 从文件里查询是否具有 Multiboot 头以便使用 grub 进行引导
$ hexdump -C /home/hanbings/github/arceos-umhv/arceos-vmm/arceos-vmm_x86_64-qemu-q35.elf | grep -E '02 b0 ad 1b| d6 50 52 e8'         
00001000  89 c7 89 de eb 22 66 90  02 b0 ad 1b 02 00 01 00  |....."f.........|

# Multiboot 1 魔数：0x1BADB002
# Multiboot 2 魔数：0xE85250D6
# 说明我们这里的是 Multiboot 1 的文件
```

## Intel VMX 指令集与 AMD SVM 指令集

| **特性** | **Intel VT-x (VMCS)** | **AMD V (VMCB)** |
| --- | --- | --- |
| **数据结构名称** | Virtual Machine Control Structure (VMCS) | Virtual Machine Control Block (VMCB) |
| **数据结构存储** | 硬件内部（需要通过 **`VMREAD`** 和 **`VMWRITE`** 访问） | 显式内存结构（直接可通过内存指针访问） |
| **数据结构大小** | 不固定（硬件实现决定），通常 ≥4KB | 固定大小：4 KB |
| **访问方式** | 使用指令：**`VMREAD`**/**`VMWRITE`** | 直接内存访问 |
| **组成部分** | 多个字段：控制字段、Guest 状态字段、Host 状态字段等 | 两部分：**控制区域** 和 **状态保存区域** |
| **指令拦截机制** | 配置拦截字段：I/O 位图、MSR 位图、控制字段等 | 精细化拦截：位图支持，对指令、I/O 操作的拦截更加灵活 |
| **二级地址转换支持** | 使用 EPT（Extended Page Table） | 使用 NPT（Nested Page Table） |
| **灵活性** | 受限于硬件设计，部分功能依赖 Intel 固定的机制 | 更加灵活，因 VMCB 可直接通过内存访问，自定义更方便 |
| **事件注入功能** | 支持：通过 VMCS 的字段注入中断或异常 | 支持：通过控制区域注入中断或异常 |
| **性能优化** | VMCS 缓存到硬件中，通过 VMCS Shadowing 提高性能 | 直接内存访问，无需硬件缓存，但性能略低 |
| **断点和调试支持** | 可在 VMCS 中设置调试寄存器和断点配置 | 可通过 VMCB 的状态保存区域直接设置调试寄存器 |
| **状态保存机制** | 使用 VMCS 的 Guest 状态字段保存虚拟机寄存器及状态 | 使用 VMCB 的状态保存区域存储虚拟机寄存器及状态 |
| **扩展性** | 添加新功能需要通过硬件升级 | 可通过软件扩展 VMCB 的内容 |
| **I/O 位图支持** | 支持，通过字段配置 I/O 位图 | 支持，通过控制区域设置 I/O 位图指针 |
| **MSR（Model Specific Register）管理** | MSR 位图用于拦截和控制 MSR 访问 | MSR 拦截由拦截字段和控制区域灵活配置 |
| **时间管理（TSC 偏移）** | 支持：通过 **`TSC_OFFSET`** 字段控制 | 支持：通过 TSC 偏移字段直接操作 |
| **Nested Virtualization（嵌套虚拟化）** | 支持（**`VMCS Shadowing`**） | 支持（通过嵌套 VMCB 配置） |
| **指令支持** | 专用指令：**`VMXON`**、**`VMRESUME`**、**`VMEXIT`**、**`VMREAD`** 等 | 专用指令：**`VMRUN`**、**`VMEXIT`**、**`VMSAVE`**、**`VMLOAD`** |

### 需要做的工作为：

- CPU 虚拟化支持
- 内存虚拟化
- 中断虚拟化
- 设备虚拟化

## 目前思路

1. 为简化环境，为 https://github.com/equation314/RVM-Tutorial 适配 SVM
2. 在 RVM 中可运行的 SVM 代码移植回 https://github.com/arceos-hypervisor/x86_vcpu
3. 为 https://github.com/arceos-hypervisor/axvcpu 添加适配 SVM 的代码
4. 为 https://github.com/arceos-hypervisor/arceos-umhv 添加适配 SVM 的代码
5. 向 https://github.com/gz/rust-x86 仓库贡献 svm 代码（也许）

## 进度

[虚拟化技术：AMD SVM Hypervisor](https://blog.hanbings.io/posts/rvm-amd-support.md)