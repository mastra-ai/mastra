---
'@mastra/memory': patch
---

Observational memory no longer stops a run when the Observer model rejects an attachment. If the provider rejects the Observer request (HTTP 400, 413, 415 or 422) and the request contained images or files, the Observer retries once with those attachments replaced by text placeholders. For example, Anthropic rejects images larger than 8000 pixels, which full-page browser screenshots often exceed.
