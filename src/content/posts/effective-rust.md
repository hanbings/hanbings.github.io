---
title: 'Effective Rust - 类型 - 速查表（停止更新）'
description: 'Effective Rust 速查表 - 类型'
date: '2024-04-25 03:25:00'
tags: ['rust']
author: '寒冰'
---

本文提炼于：

[Types - Effective Rust](https://www.lurklurk.org/effective-rust/types.html)

感谢作者以及出版社为广大 Rust 提供了一本这么好的 Rust 编码参考规则。

## 一. 使用类型系统表达数据结构

1. Rust isn't a language where you're going to be doing much in the way of converting between pointers and integers — 在 C / C++ 中是允许操作内存地址的，比如加减内存地址。
2. Rust 允许在数字字面量声明类型：
   
    ```jsx
    let x = 23i32;
    ```
    
3. Rust 的 `char` 字符，在内存中仍然保持为 4 字节 `Unicode` 值，而不是转换为 32 位整数。
4. 在 Rust 中使用 `try_into()` 进行大位数的数字类型到小位数数字类型的转换，使用 `into()` 进行小位数到大位数的数字类型转换。
5. `Arrays` 用于聚合一个类型的多个实例。`Tuple` 用于聚合多个类型的多个实例，`Structs` 同样用于聚合多个类型的多个类型。但是允许通过名称来引用各个字段。
6. `enum` 允许携带一个数字或字符串值，并且具有类型安全检查。
7. 使用 `match` 的时候建议添加 `_ ⇒ {}` 作为默认选项。
8. 在 Rust 中，表达可能存在错误使用 `Result<T, E>`，表达可能不存在值使用 `Option<T>` 。

## 二. 使用类型系统表达共同行为

1. `Method` 方法，需要依附在 `enum` `structs` 等结构上，通常为 `impl 结构体名称`，在 `fn` 前使用 `pub` 表示该方法为公开方法，允许从 `impl` 块外的地方调用。
2. Rust 中呀很多很有意思的写法，根据匹配 enum 的值在一个 impl 的方法中以不同的方式进行计算，如下：
   
    ```rust
    enum Shape {
        Rectangle { width: f64, height: f64 },
        Circle { radius: f64 },
    }
    
    impl Shape {
        pub fn area(&self) -> f64 {
            match self {
                Shape::Rectangle { width, height } => width * height,
                Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
            }
        }
    }
    
    ```
    
3. Rust 支持函数指针，允许将一整个函数赋值给一个变量。
4. Rust 支持闭包，即将函数作为另一个函数的参数进行传递，当然 lambda 表达式支持也少不了。Rust 的表达式语法为 `|args…| = { … };` 。
   
    > 对于 Rust 语言而言，**这种基于语句（statement）和表达式（expression）的方式是非常重要的，你需要能明确的区分这两个概念**, 但是对于很多其它语言而言，这两个往往无需区分。基于表达式是函数式语言的重要特征，**表达式总要返回值**。 — 圣经
    > 
5. 可以使用一些 Trait 来对作为参数传入的函数类型作出限制。`FnOnce` 是指移交所有权的参数；`FnMut` 相当于 `&mut T` 指传入一个可变引用；Fn 相当于 &T，指传入引用。
   
    ```rust
    pub fn modify_all<F>(data: &mut [u32], mut mutator: F)
    where
        F: FnMut(u32) -> u32,
    {
        for value in data {
            *value = mutator(*value);
        }
    }
    ```
    
6. Rust 没有函数重载，函数重载有违 Rust 设计哲学之一的 Be Explicit，而大多数情况都可以改用泛型解决。
   
    ```rust
    use num::Num;
    
    fn plus<T: Num>(a: T, b: T) -> T {
        a + b
    }
    ```
    
7. Rust 可以依据 Trait 限制泛型边界（Trait bounds）。
   
    ```rust
    pub fn dump_sorted<T>(mut collection: T)
    where
        T: Sort + IntoIterator,
        T::Item: std::fmt::Debug,
    {
        // Next line requires `T: Sort` trait bound.
        collection.sort();
        // Next line requires `T: IntoIterator` trait bound.
        for item in collection {
            // Next line requires `T::Item : Debug` trait bound
            println!("{:?}", item);
        }
    }
    ```
    

## 三. 使用 match 表达式转换 Option 和 Result

> 
> - `[Option<T>](https://doc.rust-lang.org/std/option/enum.Option.html)`: To express that a value (of type `T`) may or may not be present
> - `[Result<T, E>](https://doc.rust-lang.org/std/result/enum.Result.html)` : For when an operation to return a value (of type `T`) may not succeed  and may instead return an error (of type `E`)
1. 正如前面所提：在 Rust 中，表达可能存在错误使用 `Result<T, E>`，表达可能不存在值使用 `Option<T>` 。
   
    我们使用 match 来匹配 Option 和 Result：
    
    ```rust
    // Option
    struct S {
        field: Option<i32>,
    }
    
    let s = S { field: Some(42) };
    match &s.field {
        Some(i) => println!("field is {i}"),
        None => {}
    }
    
    // Result
    let result = std::fs::File::open("/etc/passwd");
    let f = match result {
        Ok(f) => f,
        Err(_e) => panic!("Failed to open /etc/passwd!"),
    };
    ```
    
2. 使用 `if let` 语句或是 `if let else` 语句简化 `Option` 和 `Result` 代码的解析
   
    ```rust
    // Option
    if let Some(i) = &s.field {
        println!("field is {i}");
    }
    
    // Result
    if let Ok(i) = &s.field {
        println!("field is {i}");
    }
    ```
    
3. 应该处理或返回 `Option` 或 `Result` 而不是使用 `unwarp` 忽略封装直接返回结果。
   
    > However, in many situations, the right decision for error handling is to defer the decision to somebody else.
    > 
    
    使用 `unwarp` 时候，如果遇到 `None` 或是 `Err`，将导致代码将在此处被 `panic!`，除非你清楚自己在干什么，否则不要使用它。
    
4. 标记一个 `#[must_use]` 可以迫使使用者必须处理 `Result`。
   
    ```rust
    warning: unused `Result` that must be used
      --> src/main.rs:63:5
       |
    63 |     f.set_len(0); // Truncate the file
       |     ^^^^^^^^^^^^
       |
       = note: this `Result` may be an `Err` variant, which should be handled
       = note: `#[warn(unused_must_use)]` on by default
    help: use `let _ = ...` to ignore the resulting value
       |
    63 |     let _ = f.set_len(0); // Truncate the file
       |     +++++++
    ```
    
5. 可以使用 [? 操作符](https://doc.rust-lang.org/reference/expressions/operator-expr.html#the-question-mark-operator) 将错误向上传播。
   
    > • In particular, use these transformations to convert result types into a form where the `?` operator applies.
    > 
    
    ```rust
    pub fn find_user(username: &str) -> Result<UserId, std::io::Error> {
        let f = std::fs::File::open("/etc/passwd")?;
        // ...
    }
    ```