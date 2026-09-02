# Post 内容约定

Markdown 与 MDX 文章位于 `src/content/posts/`，使用相同的 front matter：

```yaml
---
title: '文章标题'
description: '简短说明'
created: '2026-09-02T10:00:00+08:00'
published: '2026-09-02T18:00:00+08:00'
tags: ['astro']
author: '寒冰'
---
```

- `created` 是文章创建时间，始终必填。
- `published` 是实际发布时间。非草稿必填，首页、文章列表、标签页和 RSS 都按它排序。
- `draft: true` 的文章不会进入 RSS；草稿列表按 `created` 排序。移除 `draft` 时必须同时补上 `published`。
- 时间使用带时区的 ISO 8601 格式，例如 `2026-09-02T18:00:00+08:00`。
- 旧文章的 `date` 暂时仍可读取，但新文章不应再使用。

可选字段包括 `draft`、`background`、`backgroundOpacity` 和 `author`。
