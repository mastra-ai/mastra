---
'@mastra/longmemeval': patch
---

Fixed a prompt-injection risk by rejecting system-role messages embedded in `prompt` or `messages` for AI SDK v5 calls.
