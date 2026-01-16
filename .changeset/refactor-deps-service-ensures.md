---
"@mastra/cli": patch
---

Centralize dependency installation with ensureDependencies method in DepsService. This refactor consolidates previously duplicated logic where multiple commands performed separate checkDependencies and installPackages calls. The new ensureDependencies method enables batch installation of missing dependencies while preserving existing behavior.
