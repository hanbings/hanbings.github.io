---
title: 'Markdown 边注、术语与钢琴窗测试'
description: 'Markdown 自定义指令的使用说明与渲染测试，包括文章边注、术语原文和交互式钢琴窗。'
date: '2026-07-18 14:00:00'
tags: ['markdown', '排版']
author: '寒冰'
---

这篇文章既是本站 Markdown 扩展的使用说明，也是文章边注、术语原文与钢琴窗的渲染测试。

## 语法基础

本站通过 `@astrojs/markdown-remark` 的 `unified()` processor 接入 Remark 插件。页面与 RSS 共用 `src/markdown/index.mjs` 中的插件列表，避免两套渲染结果不一致。

这里使用 [`remark-directive`](https://github.com/remarkjs/remark-directive) 实现 [Generic Directives 提案](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444)：

- `:name[label]{attributes}`：行内 text directive。
- `::name[label]{attributes}`：块级 leaf directive。
- `:::name ... :::`：块级 container directive。

Generic Directives 是 Unified/Remark 生态中的通用扩展方式，但不是 CommonMark 核心规范。它适合本站这种能够同时控制作者、解析器和输出端的场景；其他 Markdown 渲染器可能只会显示原始语法。

`src/markdown/plugins/remarkValidateDirectives.mjs` 会拒绝未知指令以及不正确的行内或块级写法，避免拼写错误静默生成无效 HTML。

## 术语原文

术语由 `src/markdown/plugins/remarkTerms.mjs` 处理，可以用 `:term[译名]{original="原文" lang="语言"}` 保留术语的原始写法：

```markdown
:term[虚拟内存]{original="virtual memory" lang="en"}
:term[context switch]{original="上下文切换" lang="zh-CN"}
```

例如，操作系统中的 :term[虚拟内存]{original="virtual memory" lang="en"} 并不等同于物理内存；Rust 的 :term[借用检查器]{original="borrow checker" lang="en"} 则会在编译期检查引用是否有效。

标注也可以反过来使用。例如在英文段落中，:term[context switch]{original="上下文切换" lang="zh-CN"} 上方显示的是中文原词。`lang` 可以省略，但在中英文混排时建议保留。

插件生成标准 HTML `<ruby>` 和 `<rt>` 元素。`<rt>` 可用于发音、翻译、音译或短注释。若内容需要离开本站的 Markdown pipeline，也可以直接使用标准 HTML，前提是目标渲染器允许 Markdown 中的 raw HTML：

```html
<ruby>虚拟内存<rt lang="en">virtual memory</rt></ruby>
```

## 文章附记

附记由 `src/markdown/plugins/remarkSidenotes.mjs` 处理。每条附记对应它后面紧跟的正文段落，因此需要把指令放在相关段落之前：

```markdown
:::sidenote
这里是附记，也支持普通的 **Markdown**。
:::

这里是与附记相关的正文。
```

:::sidenote
这是一条附记。宽屏浏览时，它位于文章右侧；可用空间不足时，它会回到正文中，因而不会挤压主要内容。
:::

这段正文用来观察附记的位置和颜色关系。便签会根据自身文字稳定映射到 64 种浅色之一；鼠标停在便签或这段文字上时，文字背景会显示相同颜色。边注适合补充背景、出处或不影响主线的细节；如果内容是理解文章所必需的，就不应该藏在边注里。

### 自定义标题与简短附记

容器可以使用自定义标题：

```markdown
:::sidenote[背景]
这里是补充背景。
:::
```

:::sidenote[背景]
自定义标题会替代默认的“附记”标签。
:::

这段正文用于观察带有自定义标题的附记。

简短附记也可以使用 leaf directive：

```markdown
::sidenote[这里是简短附记。]
```

::sidenote[这是一条使用 leaf directive 编写的简短附记。]

这段正文用于观察简短附记。

### 附记中的 Markdown

:::sidenote
附记可以包含 **强调**、`inline code` 和[链接](https://www.markdownguide.org/)，也可以写成多个段落。

不过，它仍然应该尽量简短。
:::

这条附记用于检查富文本和多段内容。连续使用多条附记时，它们会在右侧依次排列，而不是互相覆盖。

## 钢琴窗

钢琴窗由 `src/markdown/plugins/remarkPiano.mjs` 处理。它使用科学音高记号描述按下的琴键，例如中央 C 是 `C4`，升 C 可以写成 `C#4` 或 `C♯4`，降 D 也可以写成 `Db4`：

```markdown
::piano[C 大调和弦]{notes="C4 E4 G4"}
```

::piano[C 大调和弦]{notes="C4 E4 G4"}

`notes` 可以使用空格、逗号或顿号分隔。浏览者可以点击琴键切换按下状态，钢琴窗会实时列出当前音符；“清空”按钮会释放全部琴键。

钢琴窗默认从 `C4` 开始显示两个八度。可以用 `octave` 指定起始八度，用 `octaves` 指定一到四个八度：

```markdown
::piano[低音区的 F 小调和弦]{notes="F2 Ab2 C3" octave="2" octaves="2"}
```

::piano[低音区的 F 小调和弦]{notes="F2 Ab2 C3" octave="2" octaves="2"}

降号会被规范到对应的升号琴键，因此上例中的 `Ab2` 显示为 `G♯2`。如果音名无法识别，或音符不在当前琴窗的音域内，构建会直接报错。省略 `notes` 则会生成一架没有预先按下琴键的钢琴：

```markdown
::piano[试着按下几个音]
```

::piano[试着按下几个音]

## 窄屏、RSS 与无障碍

插件生成 `<aside role="note">`，并把它后面紧跟的段落标记为对应正文；如果附记后没有正文段落，构建会直接报错。在手机或较窄的窗口中，附记会成为带有标题的正文块；术语原文则继续显示在术语上方。

钢琴窗中的每个琴键都是带有按下状态的按钮，可以通过键盘聚焦并操作。琴键较多或屏幕较窄时，键盘区域可以横向滚动；RSS 中则保留标题与初始音符文字，不依赖交互脚本。

RSS 使用同一套 Markdown renderer，并保留 `<aside>`、`<ruby>` 与 `<rt>` 的语义，因此不会泄漏未解析的 directive 源码。

## 相关规范与文档

- [CommonMark](https://spec.commonmark.org/)
- [Astro Markdown](https://docs.astro.build/en/guides/markdown-content/)
- [Generic Directives](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444)
- [remark-directive](https://github.com/remarkjs/remark-directive)
- [HTML `<rt>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/rt)
