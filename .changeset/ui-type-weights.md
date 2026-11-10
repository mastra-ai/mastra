---
'@mastra/playground-ui': minor
---

Improved text readability with heavier weights. Body copy, table cells, captions and menus now render at weight 465 instead of 400, which read thin on dark surfaces. Labels and headings move from 500 to 515 so they keep standing out.

Roles now draw from two weight tokens, `--font-weight-normal` (465) and `--font-weight-medium` (515). The `font-normal` and `font-medium` utilities resolve to the same tokens, and text without a role inherits the regular weight, so emphasis stays on one scale.
