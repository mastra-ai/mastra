---
'@mastra/core': patch
---

Fixed tool-call input parsing crashing on malformed JSON from OpenRouter providers. The stream transform now applies progressive sanitization: stripping trailing LLM tokens (`<|call|>`, `<|endoftext|>`) and replacing invalid placeholder values (`?` → `null`). When all recovery attempts fail, a warning is logged instead of an error and the tool call proceeds with undefined args instead of throwing.
