---
'@mastra/factory': patch
---

Work-item feeds handed to Factory role sessions now say when text is missing. A comment or reply quote cut at 2,000 characters ends with a marker like `[truncated: 2,000 of 2,842 characters; comment <id>]`. When older comments don't fit, the block opens with `[N older comments omitted]` (`N+` when the comment cap was reached).
