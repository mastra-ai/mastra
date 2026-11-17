---
'@mastra/factory': patch
---

Fixed slow reading of the pull request number from GitHub card keys that contain very long runs of digits. The number returned is unchanged.
