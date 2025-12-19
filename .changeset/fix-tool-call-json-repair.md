---
"@mastra/core": patch
---

Fixed handling of malformed JSON in tool-call inputs during streaming. Tool-call payloads that are incomplete or invalid are now automatically repaired, preventing crashes in streaming scenarios. Resolves #11078.