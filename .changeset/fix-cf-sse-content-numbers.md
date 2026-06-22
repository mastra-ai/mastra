---
'@mastra/core': patch
---

Fix Cloudflare Workers AI streaming dropping numeric content tokens

When using Cloudflare Workers AI with streaming, citation markers like `[^1]`
rendered as `[^]` because single-digit content tokens were sent as numbers
instead of strings. Numeric tokens are now properly preserved so citations and
other digit-based content render correctly.
