# Typst 论文 Post 内容约定

Typst 论文是 post 的一种，与 Markdown 文章共同显示在 `/posts/`。每篇论文位于 `src/content/posts/<slug>/`，目录名只使用小写字母、数字和连字符。

必需文件：

- `paper.json`：网站使用的论文元数据。
- `paper.typ`：默认的 Typst 主文件；可通过 `paper.json` 的 `source` 字段修改。

同一目录可以继续放置章节、图片、CSV 数据、Hayagriva/BibLaTeX 文献库等 Typst 项目文件。任一文件发生变化都会使该论文的构建缓存失效。

构建会同时生成：

- 语义化 HTML：提取正文后放入博客自己的页面结构，由 `.typst-body` 负责样式。
- PDF：保留 Typst 的分页、字体与打印排版，作为下载和归档版本。
- Typst 主源文件：供读者下载。

Typst 的 HTML 导出目前是实验功能。页面、绝对定位等只适合分页输出的规则应该使用 `target()` 分流；正文、标题、列表、表格、链接、文献引用和公式可以由两个目标共享。

```typst
#let paper(body) = context {
  if target() == "paged" {
    set page(paper: "a4")
    // 仅 PDF 使用的标题页、页眉页脚等
    body
  } else {
    // HTML 正文由博客 CSS 排版
    body
  }
}

#show: paper
```

`paper.json` 的基本结构：

```json
{
  "title": "Paper title",
  "description": "用于搜索结果的简短说明",
  "date": "2026-08-04",
  "authors": [
    {
      "name": "Author Name",
      "affiliation": "Institution",
      "email": "author@example.com",
      "orcid": "0000-0000-0000-0000"
    }
  ],
  "abstract": "Abstract text.",
  "keywords": ["keyword"],
  "language": "en",
  "source": "paper.typ"
}
```

可选字段包括 `subtitle`、`updated`、`draft`、`venue`、`doi`、`repository`、`license`、`tags`、`background` 和 `backgroundOpacity`。

构建需要 Typst 0.15.1。默认执行文件名是 `typst`；如果安装在其他位置，可以设置 `TYPST_BIN`。
