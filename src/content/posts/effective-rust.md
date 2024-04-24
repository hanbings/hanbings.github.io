---
title: 'Effective Rust 速查表（正在施工）'
description: 'Effective Rust 速查表'
date: '2024-04-25 03:25:00'
tags: ['rust']
author: '🐱 寒冰'
---

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