---
'mastra': patch
---

Fixed peer dependency checker to correctly validate prerelease versions (e.g., 1.1.0-alpha.1 now satisfies >=1.0.0-0 <2.0.0-0)
