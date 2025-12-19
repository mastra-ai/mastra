---
"@mastra/core": patch
---

Fix malformed JSON handling in tool-call inputs by adding automatic JSON repair functionality. The `convertFullStreamChunkToMastra` function now gracefully handles malformed or incomplete JSON from tool-call chunks using the `jsonrepair` library. This prevents crashes during streaming scenarios when processing partial or invalid tool-call payloads. Resolves #11078.