---
'@mastra/factory': patch
---

Fixed `submit_plan` rejecting a readable plan with "this session has no workspace root" when a Factory session's remote sandbox was still cold when its workspace was resolved. The session's workspace root is now set as soon as the first file operation resolves the remote checkout.
