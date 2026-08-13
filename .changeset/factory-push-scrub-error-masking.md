---
'@mastra/factory': patch
---

Fixed a failed branch push being reported as the wrong error when token cleanup also failed. The cleanup error used to replace the push error entirely, so a push blocked by network egress surfaced as a token-cleanup failure with an unrelated classification. The push failure now keeps the lead and its classification, with the cleanup failure reported alongside.
