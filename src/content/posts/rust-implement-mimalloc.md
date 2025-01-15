---
title: 'Rust：实现一份 Mimalloc（Draft）'
description: 'Rust 实现一份 Mimalloc -- Chaos HMM (Chaos Heap Memory Manager)'
date: '2024-12-12 04:32:03'
tags: ['rust', 'os', 'alloc']
author: '寒冰'
---


参考：

- [[论文阅读] Mimalloc: Free List Sharding in Action](https://www.bluepuni.com/archives/paper-reading-mimalloc-free-list-sharding-in-action/)
- [论文原文](https://www.microsoft.com/en-us/research/uploads/prod/2019/06/mimalloc-tr-v1.pdf)

## **mimalloc 核心机制**

### **分配（空间）局限性（ Locality of Allocation）**

采用极端小页（mimalloc 页，与操作系统内存页有区别，前者只是在 mimalloc 系统中的页概念，除非另有声明，后文的页都指 mimalloc 页，这里的极端小页为 64 k），并为每一个页提供空闲列表。分配过程中尽可能在一个页中分配，直到本页被分配满，即优先分配本页空间。

这种机制有助于：

- 提高 CPU 缓存的命中率
- 减少内存访问的随机性
- 缓解内存碎片化

### **free_list、local_list 与 thread_list**

使用分离的处理方式存储不同类别的内存。free_list 存储从未分配的内存，local_list 存储从本线程释放回来的内存空间，thread_list 存储其他线程释放回来的空间。

每一个页都有自己的 free_list、local_list 与 thread_list。

本地线程与其他线程的意思是，假设我们从 A 线程（主线程）和 B 线程（开辟的子线程）申请两次内存并释放，假设主线程释放的内存与 allocator 所处线程一致，那么这片内存将返还到 local_list，而 B 线程的释放的内存则会先到 thread_list 中，等待处理。

在 mimalloc 中，local_list 和 thread_list 并不是马上进行回收到 free_list 的，mimalloc 优先从 free_list 分配内存，然后出现两种两种情况：

- 快路径（fast allocation path）
  
    free_list 还有空闲内存，直接分配。（这块在 mimalloc 的 c 语言官方实现版本仅五行代码）
    
- 慢路径（generic allocation path）
  
    free_list 没有空闲内存了。从 local_list 分配，如果也空闲内存了，那么将触发回收机制，从 thread_list 原子性的回收其他线程释放的内存。这里的原子性，指的不仅仅是内存回收时会移动链表指针到别的链表里，且还需要锁定几个全局性的变量：使用量、本页使用量等。
    

为了防止存在不断申请马上又释放的内存同时占用了 free_list 和 local_list 造成了性能下降，每当固定几次申请内存（maintain a deterministic heartbeat）就会触发一次内存回收。

### **不使用碰撞指针**

是指划分一段连续内存段，定义一根在段内的指针，指针的左边是已使用内存，右边是未使用内存。当申请了一些内存后，实际分配从指针开始，指针向右边挪一点表示已使用内存增加了，反之，如果释放了一些内存就向指针左挪一点。

缺点很明显：

1. 内存分配和释放不一定是连续的，如果采用整理算法，又增加了整体的复杂性
2. 安全性较低，容易被溢出攻击

## **Chaos HMM 实现**

本实现并未过多参考 [c 语言版本的官方实现](https://github.com/microsoft/mimalloc)，仅对论文进行实现。

### **简要描述**

划分为堆（Heap）、段（Segment）、页（Page） 。

堆由具体的用量决定，使用 `std::alloc::System::alloc` 分配，由 Chaos HMM 决定是否要申请或是否给系统。

- 当内存将用满时向系统申请当前大小 x2 的内存用量
- 当检测到已经长时间空闲了归还系统

段分为两种段：页段和页区域段（前者指段内存在很多页，后者一段即为一段分配出去的内存）

页大小与对象大小有关：

- 对于 8 K 以下的为小对象，页面大小为 64 K，一个段中有 64 个这样的页。
- 对于 512 K 以下的大对象，页面大小为 512 K，一个段中有 8 个这样的页。
- 对于大于 512 K 的超大对象，Chaos 将分配一整个段。

对于前两种段来说，第一个页总是用于记录 free_list、local_list 和 thread_list 的，但在大对象页中，第一个页存在较多的浪费，也许可以使用 slab 再优化。

而超大对象段则需要关注对齐问题，即使只使用了 513 K，也应该分配 4 M 段。

### **数据结构**

> **错误的设计**
> 
> 
> 一开始，思路是建立一个栈上链表，并尽可能延长它的生命周期。但经群友的提醒，发现栈结构并不允许这样子，例如 Heap 生命周期始终会比 Segment 长，Segment 始终会比 Page 长，十分容易产生垂悬指针，并不能像堆内存那样长时间驻留内存。
> 
> 但栈上链表本身以下一个节点的内存地址为存储内容形成链表是可以实现的。
> 

### **Rust 全局分配器**