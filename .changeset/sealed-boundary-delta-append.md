---
'@mastra/core': patch
---

Fixed streamed tool results being duplicated when an accumulated snapshot arrived with the same id as a message from before a sealed observational memory boundary. Only the new parts are appended now, so the pre-seal prefix is no longer replayed into a fresh assistant message.

Fixed rotated response message ids not propagating to the active output stream after error processor retries, which could split a single response across two ids on the API-error retry path.
