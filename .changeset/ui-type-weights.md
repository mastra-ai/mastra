---
'@mastra/playground-ui': minor
---

Improved text readability with a heavier regular weight. Body copy, table cells, captions and menus now render at weight 450 instead of 400, which read thin on dark surfaces. Labels and headings stay at 500.

Roles now draw from two weight tokens, `--font-weight-normal` (450) and `--font-weight-medium` (500). The `font-normal` and `font-medium` utilities resolve to the same tokens, and text without a role inherits the regular weight, so emphasis stays on one scale.
