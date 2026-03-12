---
"@mastra/core": patch
---

Fixed an issue where consecutive tool-only agent turns were incorrectly merged into a single message. This caused the agent to believe it ran tools in parallel when it actually ran them sequentially, leading to incorrect behavior in subsequent responses.
