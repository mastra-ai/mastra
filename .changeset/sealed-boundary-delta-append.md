---
'@mastra/core': patch
---

Fixed rotated response message ids not propagating to the active output stream after error processor retries, which could split a single response across two ids on the API-error retry path.

Fixed processor-supplied options to `writer.custom` being dropped in the agentic execution step, so future options like `transient` now reach the underlying output writer.
