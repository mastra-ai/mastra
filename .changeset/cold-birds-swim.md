---
'@mastra/code-sdk': patch
---

Fixed provider safety rejections losing their cause. Errors now show the provider's own wording (for example Anthropic's "Your request was rejected as a result of our safety system") and the request URL, and note that these are often false positives on code or security-like text.
