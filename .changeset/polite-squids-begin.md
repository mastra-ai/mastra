---
'@mastra/core': patch
---

Fixed excessive claimed-owner discovery requests when an owner is unavailable. Signal delivery keeps the full discovery timeout and still accepts owner responses during the final attempt.
