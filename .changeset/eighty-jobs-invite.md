---
'@mastra/playground-ui': patch
---

Fixed crash when template installation errors are non-string values (e.g. objects). The error is now safely converted to a string before calling .includes(), preventing the 'e?.includes is not a function' TypeError in the studio.
