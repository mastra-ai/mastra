---
'mastra': minor
---

Deploy commands now automatically detect when source files have changed since the last build:

- If changes are detected, the CLI rebuilds before deploying — you'll never accidentally deploy outdated code
- If you use `--skip-build` but sources have changed, the CLI warns you and forces a rebuild anyway
