---
'@mastra/core': patch
---

Fixed durable agents ending a turn without an answer when Gemini returns a malformed tool call (`MALFORMED_FUNCTION_CALL`). Durable agents now retry the request like regular agents do, and report an error if the retries fail.
