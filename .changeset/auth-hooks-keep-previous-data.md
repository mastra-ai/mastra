---
'@mastra/react': patch
---

`useAuthCapabilities` and `usePermissionPatterns` keep their last result while a new client loads. Changing the server URL, prefix or headers no longer blanks pages behind auth or permission guards until the new answer arrives.
