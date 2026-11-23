---
'@mastra/code-sdk': patch
---

Fixed Mastra Code staying silent when its local embedder package `@mastra/fastembed` can't be loaded. Headless runs now print one `Warning: Memory recall is off: ...` line to stderr in every output mode, saying recall search won't work until Mastra Code is reinstalled. The exit code and stdout don't change. Embedding now fails with an `EmbedderPackageMissingError` (code `MASTRACODE_EMBEDDER_PACKAGE_MISSING`, checked with `isEmbedderPackageMissingError()`), and `onEmbedderPackageMissing()` lets an embedding app show the same notice once.
