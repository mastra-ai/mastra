---
'@mastra/factory': patch
---

Factory build and self-review runs now link Linear source issues in the change request with one `Fixes <ID>` line per issue, such as `Fixes ENG-123`, so the GitHub and Linear sync closes them on merge. An issue the work only partly resolves gets a non-closing `Refs` reference instead.
