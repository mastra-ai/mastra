---
'@mastra/opencode': patch
---

Fixed npm publish for @mastra/opencode — the dist/ folder was missing because turbo couldn't find a build task to run. Added turbo.json so the build:lib script runs correctly during CI.
