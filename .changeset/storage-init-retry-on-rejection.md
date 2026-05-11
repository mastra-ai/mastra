---
'@mastra/core': patch
---

Fixed storage init proxy caching rejected init promises. Previously, if storage `init()` failed once (for example due to a transient network error during boot), every subsequent storage call replayed the same rejection until the process restarted. The proxy now clears the cached promise on rejection so the next call retries init, while still sharing a single in-flight promise across concurrent callers and caching a successful init exactly once.
