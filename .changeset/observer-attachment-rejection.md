---
'@mastra/memory': patch
---

Fixed Observer runs that failed on oversized images, such as full-page browser screenshots that exceed Anthropic's 8000px limit. The Observer now downscales images to at most 2000px on the longest side before sending them. Stored messages keep the original images.

If the provider still rejects the request with HTTP 400, 413, 415 or 422 and the request had images or files, the Observer retries once with those attachments replaced by text placeholders. If that retry also fails, the configured `failurePolicy` applies.
