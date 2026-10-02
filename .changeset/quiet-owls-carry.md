---
'@mastra/core': patch
---

Fixed a thread failing on every turn when one of its attachments can't be used: a file that now returns 404, a relative path such as `/api/images/foo.png`, or inline content that isn't valid file data. If error processors and fallback models don't recover a failed download, the agent now answers with an `[Attachment unavailable: <name>]` placeholder and logs a warning. The attachment is recorded on its stored message, so later turns reuse the placeholder without downloading it again. See #23705.
