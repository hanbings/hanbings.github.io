---
title: 'Rust 实现插件系统'
description: 'FFI、C ABI 和 dynlib 的 Rust 插件系统'
date: '2024-11-09 17:50:11'
tags: ['rust', 'dynlib', 'ffi', 'c-abi']
author: '🐱 寒冰'
---

## 目标

实现插件系统，通常有两种方式：

1. 语言自身支持某种加载方式允许动态加载外部代码。比如加载**动态链接库，**又或是像 Java 这类语言的虚拟机允许加载中间文件甚至是源代码。
2. 通过语言引擎运行外部代码，例如 Java 中使用 ScriptEngine 和Rust 中使用 https://github.com/boa-dev/boa 执行 JavaScript。

此外，还可以通过向外暴露 HTTP / WebSocket 等接口实现插件接口，也是一种可行的插件系统设计。

但无论是通过语言引擎运行外部代码还是暴露 HTTP / WebSocket 接口，前者会带来数据交换的损耗而后者不仅带来数据交换所耗费的空间还会带来网络传输的延迟。这样的性能损耗对于这个插件系统的应用场景：分布式计算设施 — 大部分情况下是不可接受的，因此我们选取以动态链接库作为插件的形态，并通过 FFI（Foreign Function Interface） 向插件暴露接口。

本插件系统需要实现的技术目标：

1. 以动态链接库作为插件的形态，即需要一个加载器允许在运行时加载插件。
2. 允许插件向加载器提供元信息（允许加载器调用插件内的函数）
3. 允许插件执行加载器提供的 API （允许插件调用加载器内的函数）

## 加载器侧

*这里我们使用到了 https://github.com/OpenByteDev/dlopen2 作为加载动态链接库的加载器，所列代码中依赖版本为 `0.7.0`（`dlopen2 = "0.7.0"`），其主要原因是 dlopen2 允许将被加载的动态链接库自动映射到一个结构体中，免去了再手动使用函数名称查找函数的步骤。*

创建一个 `src/main.rs` 的新文件，然后定义一个主函数 `fn main() {}` 。

设计一个函数 `simple_add_two_numbers`，它的任务是将两个参数 `a` 和 `b` 相加，并在后面的插件侧代码中输出，但是需要声明在一个看起来有点奇怪的结构体中。

```rust
#[repr(C)]
#[derive(WrapperApi)]
struct Adder {
    simple_add_two_numbers: unsafe extern "C" fn(
        a: c_int,
        b: c_int,
    ),
}
```

注意！其中的  `#[repr(C)]` 和 `unsafe extern "C"` ，前者是用于声明结构体按 C 语言的结构体的内存结构进行布局（是的，Rust 的结构体内存布局与 C 语言并不一样，在黑魔书中有提及：https://doc.rust-lang.org/nomicon/other-reprs.html），而 `extern` 是 Rust 语言专为 FFI 接口设计的向外暴露函数的关键字，`extern "C”` 意为按照 C 语言的 ABI （Application Binary Interface 定义了如何在汇编语言层面调用此函数）接口标准向外暴露函数。它们都是必要的写法。



### 关于结构体的内存布局

Rust 一些 unsafe 操作允许操作内存，例如 `std::mem::transmute`，可以将结构体 A 替换为结构体 B。很好玩的是，Rust 提供了结构体 A、B 的长度检查，只有两个结构体长度一致才可以通过编译，而不检查类型是否一致。也就是说：

```rust
// 是能够成功转换的
struct A {
    e: u16,
    a: u8,
    b: u8
}

struct B {
    e: u8,
    a: u8,
    b: u8,
    c: u8,
}

// 不能成功转换
struct A {
    e: u16,
    a: u8,
    b: u8
}

struct B {
    e: u16,
    a: u8,
    b: u8,
    c: u8,
}
```

而：

```rust
struct A {
    e: u16,
    a: u8,
    b: u8
}

struct B {
    e: bool,
    a: bool,
    b: bool,
    c: u8,
}
```

也是可以转换成功的，因为一个 `bool` 值会占用 `u8` 长度的内存空间。本文想要提醒的是，不同的 C 语言编译器也许会将多个 `boolean` 压缩到一个 8 位或是说结构体对齐长度中来优化内存。



### 关于 `c_int`

[Rust Docs - std/ffi/type.c_int](https://doc.rust-lang.org/std/ffi/type.c_int.html) 文档中，可以看到解释为与 C 语言中（未提及具体标准或版本）的 `signed int`（也就是 int） 相等。实际上它只是一个类型别名 `pub type c_int = i32;` 。

[Rust Docs - std/ffi/types](https://doc.rust-lang.org/std/ffi/index.html#types) 可以看到更多用于在 Rust 中绑定到 C 语言（的类型）的类型别名，应该在编写 FFI 代码时候尽可能使用它们来避免不经意间使用了那些不支持的类型。

同时 [Rust Docs - std/ffi/structs](https://doc.rust-lang.org/std/ffi/index.html#structs) 还定义了一些与字符串相关的工具，使用它们可以避免不受非法字符串的攻击。比如使用 [Rust Docs - std/ffi/structs.OsString](https://doc.rust-lang.org/std/ffi/struct.OsString.html) 替代 `String`。



接着使用 dlopen2 进行动态链接库的加载：

```rust
let cont: Container<Adder> =
        unsafe { Container::load("./target/debug/luminous.dll") }
            .expect("Could not open library or load symbols");
```

其中 `Container::load("")` 将指定加载哪一个动态链接库文件，在 Windows 下后缀名为 `dll`，macOS 为 `dylib` 以及 Linux 为 `so` 。

别忘了，需要声明一个泛型参数并传入定义的结构体 `let cont: Container<Adder> = …`

好啦！然后调用它！

```rust
let a = 1;
let b = 2;

unsafe {
    cont.simple_add_two_numbers(a, b);
}
```

等等，还没有在插件侧编写这个函数的实现呢！

![f266493fda738ea504599bf156ef1fa1.jpg](https://picture.hanbings.io/2024/11/09/f266493fda738ea504599bf156ef1fa1.jpeg)

## 插件侧

好的，创建 `src/lib.rs` 文件：

```rust
use std::os::raw::c_int;

#[no_mangle]
pub unsafe extern "C" fn simple_add_two_numbers(
    a: c_int,
    b: c_int
) {
    println!("{} + {} = {}", a, b, a + b)
}
```

并在 cargo.toml 写上：

```rust
[lib]
crate-type = ["cdylib"]
```

然后使用 `cargo build` 即可生成动态链接库。

编译，然后运行它吧！`cargo run`！



### 关于 `#[no_mangle]`

这里的 `#[no_mangle]` 用于来告诉 Rust 编译器不要混淆此函数的名称。

混淆是指 Rust 编译器会将函数更改为别的名称，这个名称包含更多信息，可以给编译过程的其他部分使用，但可读性较差。每种编程语言编译器对名称的混淆都略有不同，因此，为了让 Rust 函数可以被其他语言命名，必须禁用 Rust 编译器的名称混淆。

文档：https://doc.rust-lang.org/book/ch19-01-unsafe-rust.html#calling-rust-functions-from-other-languages



接着我们需要添加一个函数回调（Callback），其实就是加载器向插件传递函数的内存地址（也就是指针）的过程。

在 `src/main.rs` 中添加：

```rust
pub type AddCallback = unsafe extern "C" fn(c_int);

pub unsafe extern "C" fn on_two_numbers_added(result: c_int) {
    println!("Got {}!", result);
}
#[repr(C)]
#[derive(Debug, Copy, Clone, WrapperApi)]
struct Adder {
    simple_add_two_numbers: unsafe extern "C" fn(
        a: c_int,
        b: c_int,
        callback: AddCallback
    ),
}
unsafe {
    cont.simple_add_two_numbers(a, b, on_two_numbers_added);
}
```

然后在 `src/lib.rs` 也做出相应修改：

```rust
#[no_mangle]
pub unsafe extern "C" fn simple_add_two_numbers(
    a: c_int,
    b: c_int,
    callback: AddCallback
) {
    println!("{} + {} = {}", a, b, a + b);
    callback(a + b);
}
```

![ff37f8648bdfd032eb4c3e6583b9fb79.jpg](https://picture.hanbings.io/2024/11/09/ff37f8648bdfd032eb4c3e6583b9fb79.jpeg)

至此，终于完成三个技术目标啦！

## 完整代码：

请留意一下有关于命名的位置，比如加载侧的动态链接库名称和 `cargo.toml` 的包名。

`src/main.rs`

```rust
use std::os::raw::c_int;
use dlopen2::wrapper::{Container, WrapperApi};

pub type AddCallback = unsafe extern "C" fn(c_int);

#[repr(C)]
#[derive(Debug, Copy, Clone, WrapperApi)]
struct Adder {
    simple_add_two_numbers: unsafe extern "C" fn(
        a: c_int,
        b: c_int,
        callback: AddCallback
    ),
}

pub unsafe extern "C" fn on_two_numbers_added(result: c_int) {
    println!("Got {}!", result);
}

fn main() {
    let a = 1;
    let b = 2;

    let cont: Container<Adder> =
        unsafe { Container::load("./target/debug/luminous.dll") }
            .expect("Could not open library or load symbols");

    unsafe {
        cont.simple_add_two_numbers(a, b, on_two_numbers_added);
    }
}
```

`lib.rs`

```rust
use std::os::raw::c_int;

pub type AddCallback = unsafe extern "C" fn(c_int);

#[no_mangle]
pub unsafe extern "C" fn simple_add_two_numbers(
    a: c_int,
    b: c_int,
    callback: AddCallback
) {
    println!("{} + {} = {}", a, b, a + b);
    callback(a + b);
}
cargo.toml
```

`cargo.toml`

```toml
[package]
name = "luminous"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "luminous"
path = "src/main.rs"

[lib]
crate-type = ["cdylib"]

[dependencies]
dlopen2 = "0.7.0"
```

## 参考

[Foreign Function Interface](https://doc.rust-lang.org/nomicon/ffi.html)

[Rust Closures in FFI](https://adventures.michaelfbryan.com/posts/rust-closures-in-ffi/)