---
'@mastra/server': patch
'@mastra/core': patch
---

Permission checks in server handlers now use the same provider as route-level checks. If you configure access control only under `studio`, Studio requests are checked against it, including thread access. A request with no applicable provider is denied instead of allowed.
