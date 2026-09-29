---
'@mastra/core': patch
---

Fixed `createRunCommandTool` security checks on Windows. `allowedBasePaths` now accepts working directories with backslash paths (previously every subdirectory was rejected), command allow/block lists now recognize Windows paths such as `C:\tools\rm.exe`, and the unsafe-character filter now rejects dangerous input consistently on every call.
