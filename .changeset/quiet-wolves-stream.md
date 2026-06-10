---
'@mastra/islo': patch
---

Route sandbox lifecycle and streaming exec calls through the Islo compute API, while keeping token exchange on the control API. This also documents foreground-only process support and pauses sandboxes on `stop()` so they can be resumed.
