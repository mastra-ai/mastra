---
'@internal/llm-recorder': minor
---

Added binary artifact support for non-JSON request/response payloads (for example audio) in the LLM recorder.

Binary bytes are now written as hash-based sidecar files in `__recordings__/` and referenced from JSON recordings with metadata (`contentType`, `size`, and artifact `path`). Replay restores the original binary payload and content-type headers from artifacts, while keeping JSON fixtures small and readable.
