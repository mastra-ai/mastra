---
'mastra': patch
---

Fixed peer dependency checker:
- Correctly validates prerelease versions (e.g., 1.1.0-alpha.1 now satisfies >=1.0.0-0 <2.0.0-0)
- Fix command now suggests upgrading the outdated peer dependency (e.g., @mastra/core) instead of the packages that require it
