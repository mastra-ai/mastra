---
'@mastra/code-sdk': patch
---

Fixed thread locks so simultaneous local processes cannot claim the same thread. Lock files are created exclusively and carry a generation so stale locks are superseded instead of deleted. (#21243)
