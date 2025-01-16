---
title: 'Rust：使用 uefi-rs 编写一个 UEFI 应用并加载内核'
description: 'Rust：使用 uefi-rs 编写一个 UEFI 应用并加载内核'
date: '2025-01-16 03:02:16'
tags: ['rust',  'uefi', 'os', 'kernel', 'bootloader']
author: '寒冰'
---


本文主要介绍如何使用 Rust 和 [uefi-rs](https://github.com/rust-osdev/uefi-rs) 库编写一个 EFI 引导加载程序（Bootloader），该 Bootloader 实现加载并跳转到一个简单的内核，内核则负责在显示区域绘制颜色。

整个过程分为以下步骤：

1. 加载文件系统协议；
2. 使用文件系统协议从指定路径加载文件元数据；
3. 从元数据中获取文件大小；
4. 根据文件大小分配内存空间；
5. 加载文件的实际内容；
6. 初始化显示协议；
7. 设置寄存器并跳转至内核代码；
8. 在内核中绘制颜色。

## 使用 uefi-rs 库

### UEFI

UEFI（Unified Extensible Firmware Interface），统一可扩展固件接口，是一个负责连接硬件和软件之间的接口。

本文是为了编写了一个可以加载内核的引导器，因此将对使用 `uefi-rs`、 `Boot Service` 和 `Runtime Service` 以及一些必要的 `Handle` 和 `Protocol` 进行说明，但不会对于 UEFI 本身进行详细的解析，如果对这一方面想要深入了解可以参考 [UEFI 手册](https://uefi.org/specs/UEFI/2.10/index.html)、罗冰老师的《UEFI 编程实践》和戴正华老师的《UEFI 原理与编程》。

### uefi-rs

> Our mission is to provide safe and performant wrappers for UEFI interfaces, and allow developers to write idiomatic Rust code. -- uefi-rs
> 

[EDK2](https://github.com/tianocore/edk2) （EFI Development Kit）是 UEFI 的开发工具包，使用 C 语言进行 UEFI 工程编程。[uefi-rs](https://github.com/rust-osdev/uefi-rs) 是 rust 语言下的 EDK2 封装，巧妙运用了很多 rust 语言的语言特性，使得开发效率大大提升。

现有大多数的 UEFI 编程资料是基于 C 语言的，使用了很多指针特性来实现功能。在 Rust 中我们有更好的写法抽象和隐藏或安全传递这些指针，因此这里的主要目的是记录 C 语言的写法与 Rust 写法的异同，以便应对阅读参考资料代码时的语言障碍。（如果您有 C / C++ 基础且掌握 Rust 语言那就更好了！）

> 在本文中我们主要针对 `uefi-rs > 0.33` 的版本进行代码编写
> 

### **数据类型**

从数据类型说起：

在 EDK2 中，为了适配多种不同架构不同位数的 CPU 而对 C 语言的数据类型系统进行了封装，这些数据类型基本能够对应到 Rust 的类型系统中，下表是从 UEFI 手册中抽取的一部分，完整表格在[这里](https://uefi.org/specs/UEFI/2.10/02_Overview.html#data-types)查看。

| EDK2 Type | Rust / uefi-rs Type | Description |
| --- | --- | --- |
| *BOOLEAN* | bool | Logical Boolean. 1-byte value containing a 0 for **FALSE** or a 1 for **TRUE**. Other values are undefined. |
| *INTN* | iszie | Signed value of native width. (4 bytes on supported 32-bit processor instructions, 8 bytes on supported 64-bit processor instructions, 16 bytes on supported 128-bit processor instructions) |
| *UINTN* | usize | Unsigned value of native width. (4 bytes on supported 32-bit processor instructions, 8 bytes on supported 64-bit processor instructions, 16 bytes on supported 128-bit processor instructions) |
| *INT8* | i8 | 1-byte signed value. |
| *UINT8* | u8 | 1-byte unsigned value. |
| *INT16* | i16 | 2-byte signed value. |
| *UINT16* | u16 | 2-byte unsigned value. |
| *INT32* | i32 | 4-byte signed value. |
| *UINT32* | u32 | 4-byte unsigned value. |
| *INT64* | i64 | 8-byte signed value. |
| *UINT64* | u64 | 8-byte unsigned value. |
| *INT128* | i128 | 16-byte signed value. |
| *UINT128* | u128 | 16-byte unsigned value. |
| *CHAR8* | CStr8 | 1-byte character. Unless otherwise specified, all 1-byte or ASCII characters and strings are stored in 8-bit ASCII encoding format, using the ISO-Latin-1 character set. |
| *CHAR16* | [CStr16](https://docs.rs/uefi/latest/uefi/data_types/struct.CString16.html) | 2-byte Character. Unless otherwise specified all characters and strings are stored in the UCS-2 encoding format as defined by Unicode 2.1 and ISO/IEC 10646 standards. |

其中，CStr8 和 CStr16 可以分别使用宏 [cstr8](https://docs.rs/uefi-macros/latest/uefi_macros/macro.cstr8.html) 和 [cstr16](https://docs.rs/uefi-macros/latest/uefi_macros/macro.cstr16.html) 进行构建。

此外常用的还有：

**EFI_STATUS**，用于表达函数返回状态（是否出错，是否有值）。

**EFI_HANDLE**，即是后续我们会提到的 Handle。

### **修饰符**

在 UEFI 手册中的接口描述中，使用了一些助记词作为参数的修饰符，如下：

| **Mnemonic** | **Description** |
| --- | --- |
| *IN* | Datum is passed to the function. |
| *OUT* | Datum is returned from the function. |
| *OPTIONAL* | Passing the datum to the function is optional, and a *NULL* may be passed if the value is not supplied. |
| *CONST* | Datum is read-only. |
| *EFIAPI* | Defines the calling convention for UEFI interfaces. |

### **入口函数**

**EDK2：**

```
EFI_STATUS EFIAPI main (
   IN EFI_HANDLE ImageHandle,
   IN EFI_SYSTEM_TABLE *SystemTable
) { }
```

> **uefi-rs：**
> 
> 
> ```
> fn main(image_handle: Handle, mut system_table: SystemTable<Boot>) -> Status { }
> ```
> 
> 可以看到 IN 类型数据写法实际上是没有什么区别的，但在 Rust 中能够隐藏指针类型和添加准确的泛型。
> 
> 在入口中 Image Handle 指向当前 Image（其实也就是当前 EFI 程序），System Table 是一个 UEFI 环境下的全局资源表，存有一些公共数据和函数。
> 

新版本的 uefi-rs API 与旧版本有所不同，下面的新版本的主函数代码：

```rust
#[entry]
fn main() -> Status { }
```

其中原先作为参数传递的 `image_handle` 和 `system_table` 现在以 `uefi::boot::image_handler()` 和 `uefi::table::system_table_raw()` 或 `uefi_raw::table::system` 的形式提供。

### **调用函数**

一般来说，在 EDK2 中函数的返回值为 EFI*STATUS 类型，（返回的）数据地址会赋值给参数类型为指针的 _OUT* 参数中，这意味着调用一个函数的步骤是：

1. 在手册中找到函数所在的 `Table`、`Service`、`Handle` 和 `Protocol` 等对应的数据结构，以函数指针 `>` 的方式访问函数。
2. 查看哪些是 *IN* 类型参数，哪些是 *OUT* 类型参数
3. 准备好用于 *OUT* 类型参数的空指针
4. 调用后判断 EFI*STATUS 而得到 _OUT* 类型参数的指针是否已指向数据
5. 从 *OUT* 类型参数取出数据

以获取 Graphics Output Protocol 为例子：

**EDK2：**

使用 [LocateProtocol](https://uefi.org/specs/UEFI/2.10/07_Services_Boot_Services.html?highlight=locateprotocol#efi-boot-services-locateprotocol) 函数获取 Graphics Output Protocol。

其函数原型为：

```
typedef
EFI_STATUS
(EFIAPI *EFI_LOCATE_PROTOCOL) (
  IN EFI_GUID                            *Protocol,
  IN VOID                                *Registration OPTIONAL,
  OUT VOID                               **Interface
 );
```

我们需要关注的是第三个参数 Interface，可以看到是一个指针类型的 OUT 类型参数。

> On return, a pointer to the first interface that matches Protocol and Registration. -- EFI_LOCATE_PROTOCOL - Interface
> 

因此有代码：

```
// 声明一个状态，用于接受函数表明执行状态的返回值
EFI_STATUS Status;
// 提前声明一个指针用于指向函数的返回值数据
EFI_GRAPHICS_OUTPUT_PROTOCOL *GraphicsOutput;

// gBS 是 BootService，通过 SystemTable->BootService 获取
Status = gBS->LocateProtocol(
    // gEfiGraphicsOutputProtocolGuid 定义在头文件中，是 Graphics Output Protocol 的 UUID
    &gEfiGraphicsOutputProtocolGuid,
    NULL,
    (VOID **)&GraphicsOutput
);
if (EFI_ERROR(Status)) {
    return Status;
}
```

**uefi-rs：**

基于 Rust 的特性，可以使用 Result 替换掉 EFI_STATUS 这种需要额外声明一个变量来存放状态的方式。

```
let graphics_output_protocol_handle = boot::get_handle_for_protocol::<GraphicsOutput>()
    // 返回类型为 Result<Handle>
    // 这里便于理解直接使用了 unwarp，但在正常编码中，应该使用 map_or 或 expect 等方式显式处理错误。
    // 尤其是在 UEFI 这类难于调试的环境下，应该尽可能地留下有用的错误信息
    .unwrap();

let mut graphics_output_protocol = boot::open_protocol_exclusive::<GraphicsOutput>(graphics_output_protocol_handle)
    // 返回类型为 Result<ScopedProtocol<GraphicsOutputProtocol>>
    .unwrap();
```

## UEFI Application 与 UEFI Protocol

```rust
uefi::helpers::init().unwrap();
```

`uefi-rs` 包中提供了 `uefi::helper::init()` 对 `uefi::allocator::Allocator`、`log` 和 `print!` 宏进行初始化以辅助开发。

### SimpleFileSystem Protocol

```rust
// load simple file system protocol
let simple_file_system_handle = 
    uefi::boot::get_handle_for_protocol::<SimpleFileSystem>().unwrap();
let mut simple_file_system_protocol = 
    uefi::boot::open_protocol_exclusive::<SimpleFileSystem>(simple_file_system_handle)
        .unwrap();
        
// open volume
let mut root = simple_file_system_protocol.open_volume().unwrap();
```

> 请注意，代码中使用了许多的 `unwrap()` 来展开 `Option` 或 `Result`，主要是为了避免在此处编写过多的错误处理逻辑。然而，在 `uefi-rs` 环境下调试较为困难，通常应显式地处理这些错误，例如打印日志或寄存器状态等。
> 

### Memory Allocator

> 本段内容需要使用到的常量：
> 
> 
> ```rust
> static KERNEL_PATH: &str = "\\kernel";
> static FILE_BUFFER_SIZE: usize = 0x400;
> static PAGE_SIZE: usize = 0x1000;
> ```
> 

```rust
// open kernel file in the root using simple file system
let mut kernel_path_buffer = [0u16; FILE_BUFFER_SIZE];
let kernel_path = CStr16::from_str_with_buf(
        KERNEL_PATH, 
        &mut kernel_path_buffer
    ).unwrap();
let kernel_file_handle = root
    .open(kernel_path, FileMode::Read, FileAttribute::empty())
    .unwrap();
let mut kernel_file = match kernel_file_handle.into_type().unwrap() {
    FileType::Regular(f) => f,
    _ => panic!("This file does not exist!"),
};
info!("Kernel file opened successfully!");

// load kernel file info and size
let mut kernel_file_info_buffer = [0u8; FILE_BUFFER_SIZE];
let kernel_file_info: &mut FileInfo =
    kernel_file.get_info(&mut kernel_file_info_buffer).unwrap();
info!("Kernel file info: {:?}", kernel_file_info);
let kernel_file_size = usize::try_from(kernel_file_info.file_size()).unwrap();
info!("Kernel file size: {:?}", kernel_file_size);

// load kernel file into memory
let mut kernel_file_address = uefi::boot::allocate_pages(
    AllocateType::AnyPages,
    MemoryType::LOADER_DATA,
    kernel_file_size / PAGE_SIZE + 1,
)
.unwrap();

let kernel_file_address = unsafe { kernel_file_address.as_mut() as *mut u8 };

let kernel_file_in_memory = unsafe {
    core::ptr::write_bytes(kernel_file_address, 0, kernel_file_size);
    core::slice::from_raw_parts_mut(kernel_file_address, kernel_file_size)
};
let kernel_file_loaded_size = kernel_file.read(kernel_file_in_memory).unwrap();
info!("Kernel file loaded into memory successfully!");

let kernel_content = &mut kernel_file_in_memory[..kernel_file_loaded_size];
let kernel_address = kernel_content.as_ptr() as *const u8 as usize;
info!("Kernel file address: 0x{:x}", kernel_address);
```

本步骤用于将文件加载到内存，其中需要注意的地方是文件 handle、文件 info 都不是文件本体，且文件路径本身也是需要内存空间存放的。

我们一步步来解析这一大段代码。

这里我们开辟一个栈上数组来进行存放文件路径，即以下代码：

> 如果您从 Java 和 Python 等高度抽象且隐藏堆栈概念的语言转到 Rust，可能会觉得理解堆栈有些困难。在本文中，堆栈均指程序运行时的内存分布：堆内存和栈内存。它们的主要区别在于数据结构的存储方式以及程序员的操作权限。
> 
> 
> 栈内存主要用于存放可执行代码和生命周期受限的局部变量。其管理由编译器处理，并通过操作系统自动分配，程序通常从栈顶开始执行代码。而堆内存则主要存储动态数据，由程序员通过向操作系统申请分配。一般情况下，长度不确定的数据会优先存放在堆内存中，并通过指针进行管理。在 Rust 中，这通常表现为使用 `Box<T>` 等智能指针；而对于长度固定的数据，优先存储在栈内存中，例如 `let a = 0;` 这样的变量声明。
> 
> 所谓“在栈上开辟数组”，指的是为固定长度的数组分配栈内存空间。
> 

> 本文使用栈上数组存储文件路径，但应该也可以申请堆内存完成这个工作，有兴趣可以进行尝试，后续加载内核文件的实际内容时也会使用堆内存。
> 

```rust
// open kernel file in the root using simple file system
let mut kernel_path_buffer = [0u16; FILE_BUFFER_SIZE];
let kernel_path = CStr16::from_str_with_buf(
        KERNEL_PATH, 
        &mut kernel_path_buffer
    ).unwrap();
```

将路径加载到内存之后便可以加载文件的 `handle` ，`handle` 类似于 Java 中的 `java.io.File` 或是 C  中的 `FILE`，负责处理文件的读写熟悉，是否为目录等。以下代码用于加载 `handle` ：

```rust
let kernel_file_handle = root
    .open(kernel_path, FileMode::Read, FileAttribute::empty())
    .unwrap();
let mut kernel_file = match kernel_file_handle.into_type().unwrap() {
    FileType::Regular(f) => f,
    _ => panic!("This file does not exist!"),
};
```

成功获取到 `handle` 后则需要从 `handle` 中获取文件大小，用于确定需要分配存储内核文件的内存大小。

```rust
// load kernel file info and size
let mut kernel_file_info_buffer = [0u8; FILE_BUFFER_SIZE];
let kernel_file_info: &mut FileInfo =
    kernel_file.get_info(&mut kernel_file_info_buffer).unwrap();
info!("Kernel file info: {:?}", kernel_file_info);
let kernel_file_size = usize::try_from(kernel_file_info.file_size()).unwrap();
info!("Kernel file size: {:?}", kernel_file_size);
```

好耶！接下来是分配堆内存空间：

`uefi::boot::allocate_pages()` 接受三位参数，页类型、数据类型和页数量。我们需要使得数据段可执行，因此选择 `AllocateType::AnyPages` （任意位置的可分配内存空间）和 `MemoryType::LOADER_DATA`  （任意位置的可分配内存空间和可执行内存）。其他的类型可以在 https://docs.rs/uefi/latest/uefi/boot/enum.AllocateType.html 和 https://docs.rs/uefi/latest/uefi/mem/memory_map/struct.MemoryType.html 中查看。

`kernel_file_size / PAGE_SIZE + 1` 则是按照内核文件大小向上再多取一页，保证有足够的空间来存储内核代码。

> PAGE_SIZE：页大小，本文假设机器是以 4k 为分页的 UEFI 固件。
> 

```rust
let mut kernel_file_address = uefi::boot::allocate_pages(
    AllocateType::AnyPages,
    MemoryType::LOADER_DATA,
    kernel_file_size / PAGE_SIZE + 1,
)
.unwrap();
```

接着使用 `handle` 中的 https://docs.rs/uefi/latest/uefi/proto/media/file/struct.RegularFile.html#method.read 将文件内容加载到分配出来这片内存地址即可完成加载的功能了！

```rust
let kernel_file_address = unsafe { kernel_file_address.as_mut() as *mut u8 };

let kernel_file_in_memory = unsafe {
    core::ptr::write_bytes(kernel_file_address, 0, kernel_file_size);
    core::slice::from_raw_parts_mut(kernel_file_address, kernel_file_size)
};
let kernel_file_loaded_size = kernel_file.read(kernel_file_in_memory).unwrap();
info!("Kernel file loaded into memory successfully!");

let kernel_content = &mut kernel_file_in_memory[..kernel_file_loaded_size];
let kernel_address = kernel_content.as_ptr() as *const u8 as usize;
info!("Kernel file address: 0x{:x}", kernel_address);
```

### GraphicsOutput Protocol

```rust
// init display
let gop_handler = uefi::boot::get_handle_for_protocol::<GraphicsOutput>().unwrap();
let mut gop = 
    uefi::boot::open_protocol_exclusive::<GraphicsOutput>(gop_handler)
        .unwrap();

let graphic_info = GraphicInfo {
    frame_buffer_addr: gop.frame_buffer().as_mut_ptr() as u64,
    frame_buffer_size: gop.frame_buffer().size() as u64,
};
```

这段相对简单，用于加载 Protocol 来获取显示信息。

## Rust Inline ASM

```rust
unsafe {
    core::arch::asm!(
        "
        jmp {}
        ", 
        in(reg) kernel_address,
        in("rdi") graphic_info.frame_buffer_addr,
        in("rcx") graphic_info.frame_buffer_size,
        options(noreturn)
    );
}
```

使用 `jmp` 指令，并提供前面一些的代码中把内核文件的内存地址，就可以跳转至内核了。

另外，为了方便内核实现绘制屏幕的功能，我们还需要将显示区域的信息提前写入到寄存器中。这里我们选择 `rdi` 和 `rcx` 两个寄存器，`rdi` 写入 `frame buffer` 的基地址，而 `rcx` 写入 `frame buffer` 的大小。

> Rust 的内联汇编使用 `in(reg) value` 来为寄存器赋值，使用 `out(reg) mutable_value` 来读取寄存器的值。`options(noreturn)` 意味着执行这段汇编永不返回，相当于 `!` 或是说 `never`，可能会跳入死循环或是 `hlt` 低能耗模式。
> 

> 另外还需要注意的是，Rust 并非允许自由调整所有的寄存器，本文只是恰好使用了两个空闲的寄存器。更多内容请阅读：https://doc.rust-lang.org/reference/inline-assembly.html
> 

frame buffer 以行优先的方式将显示器的像素映射到内存中，下一步中将使用一个汇编循环语句将它填充以显示特定的颜色。

![frame buffer](https://i.miji.bid/2025/01/16/a1851c2caa53a101a2fc0a02f4a74b8b.png)

## 内核部分

```nasm
BITS 64

mov rax, 0xff408deb

display:
    mov [rdi], rax
    add rdi, 4
    loop display

jmp $
```

这就是内核的全部代码了。

正如本文开头所提到的，我们要向屏幕填充颜色 `0xff408deb`。

> 0xff408deb 的顺序为 A（Alpha）RGB，GraphicsOutput Protocol 中的颜色顺序是 BGRA，但在 x86 中以小端方式表达便是 ARGB 了。
> 

首先，程序将 RGB 值赋给 `rax` 寄存器，然后在 `display` 代码块中进行循环写入。这里，`rdi` 寄存器由 Bootloader 代码设置为 `graphic_info.frame_buffer_addr`，即显存映射到内存的起始地址。`rcx` 寄存器则保存了先前设置的 `graphic_info.frame_buffer_size`，即显存映射的总内存大小。为了在屏幕上填充这个颜色，我们需要遍历整个显存区域。

`loop` 指令用于控制循环，确保每次写入后，`rcx` 寄存器的值会减 1，直到其值为 0，才会跳出循环并执行下一条指令。通过这种方式，程序可以连续地将颜色写入显存，直到整个屏幕都被填充。

## 启动！

新建 esp 目录并拷贝 uefi 的编译结果：

> bootx64.efi 是约定名称，UEFI 固定会自动使用该文件，文件名不区分大小写。如果使用其他名字则需要进行 UEFI Shell 后手动执行。
> 

```bash
mkdir -p esp/efi/boot/
cargo build --bin efi --target x86_64-unknown-uefi
mkdir -p esp/efi/boot/
cp target/x86_64-unknown-uefi/debug/efi.efi esp/efi/boot/bootx64.efi

```

编译和拷贝内核：

```bash
nasm kernel.asm -o kernel
cp kernel esp/
```

接下来启动它吧！‘

> 注意替换 `$(OVMF_CODE_PATH)` 和 `$(OVMF_VARS_PATH)`
> 

```bash
qemu-system-x86_64 \
    -m 256 \
    -enable-kvm \
    -drive if=pflash,format=raw,readonly=on,file=$(OVMF_CODE_PATH) \
    -drive if=pflash,format=raw,readonly=on,file=$(OVMF_VARS_PATH) \
    -drive format=raw,file=fat:rw:esp
```

![test](https://i.miji.bid/2025/01/16/2027c82d740e142e3331d7aec3ecf825.png)