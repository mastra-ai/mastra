---
'@mastra/playground-ui': minor
---

Improved text readability with heavier weights. Body copy, table cells and captions now render at weight 465 instead of 400, which read thin on dark surfaces, and menus move from 450 to 465. Labels, headings and bold text in markdown move from 500 to 515 so they keep standing out.

Text roles now draw from two weight tokens, `--font-weight-normal` (465) and `--font-weight-medium` (515). Card title roles keep their own 550 and 600 weights. The `font-normal` and `font-medium` utilities resolve to the same tokens, so emphasis stays on one scale. The default body weight is now 465 instead of the browser's 400.
