---
'@mastra/core': patch
---

Fixed array textStream output so it always stays valid JSON, even when the first streamed chunk already includes elements
