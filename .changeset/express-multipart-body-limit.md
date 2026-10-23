---
'@mastra/express': patch
---

Fixed the Express adapter's body size limit for `multipart/form-data` requests sent without a `Content-Length` header (chunked uploads).

- Before, only individual files were capped, so many small files or fields, or one large text field, could push megabytes past the configured limit into a route handler. Now the whole multipart body is counted while it streams, and reading stops as soon as the limit is passed.
- Oversized multipart requests now get `413` with the configured `bodyLimitOptions.onError` response. Before, a single oversized file returned `500`.
- `413` responses close the connection instead of reading the rest of the oversized body.
