---
'@mastra/core': patch
---

Fixed TrailingAssistantGuard to protect against trailing assistant messages in all cases, not just structured output. Claude 4.6 rejects all trailing assistant messages (prefilling is no longer supported), but the guard was only active when structured output was enabled. This caused errors during thread resumption, agent handoffs, and tool-call rounds. Fixes #13969.
