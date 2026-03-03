---
'@mastra/core': minor
---

Workspace tools (list_files, grep) now automatically respect .gitignore, filtering out directories like node_modules and dist from results. Explicitly targeting an ignored path still works. Also lowered the default tree depth from 3 to 2 to reduce token usage.
