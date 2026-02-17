---
'@mastra/core': patch
---

Fixed skill processor tools (skill-activate, skill-search, skill-read-reference, skill-read-script, skill-read-asset) being incorrectly suspended for approval when `requireToolApproval: true` is set. These internal tools now bypass the approval check and execute directly.
