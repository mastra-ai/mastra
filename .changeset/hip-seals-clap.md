---
'@mastra/code-sdk': patch
---

Fixed thread locks so simultaneous local processes cannot claim the same thread. Lock files are created exclusively and now carry a generation (`<threadId>.<generation>.lock`): a stale lock left behind by a crashed process is superseded by the next generation instead of being deleted, so two processes reclaiming the same stale lock can no longer both end up owning the thread. Lock files written by earlier versions are still honoured.
