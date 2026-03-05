---
'@mastra/core': patch
---

Fixed JSON.parse failing on tool-call inputs when LLM models append internal tokens like `<|call|>` or `<|endoftext|>` to the JSON string. These trailing tokens are now stripped before parsing, so tool calls correctly receive their input parameters instead of silently losing them.
