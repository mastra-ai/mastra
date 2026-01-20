---
'@mastra/core': patch
---

Fixed duplicate storage initialization when init() is called explicitly before other methods. The augmentWithInit proxy now tracks when init() is called directly, preventing subsequent method calls from triggering init() again. This resolves the high volume of requests to storage backends (like Turso) during agent streaming with memory enabled.
