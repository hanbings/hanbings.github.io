# Styles

`global.css` is the site-wide entry point. Its import order is part of the cascade and should remain stable.

- `base/`: theme tokens and document-level browser behavior.
- `components/`: reusable site components and page sections.
- `layouts/`: multi-region page layout rules.
- `pages/`: styles owned by one page.
- `markdown/`: Markdown defaults, site-specific element overrides, and MDX component styles.

`markdown/github.css` is the ordered entry point for the split GitHub Markdown stylesheet. Keep its module imports in their current order when adding or moving rules.
