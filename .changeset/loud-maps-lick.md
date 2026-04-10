---
'mastra': patch
---

Fixed deploy commands failing with 'No such file or directory' when the mastra source directory is a subdirectory (e.g. `mastra server deploy src`). The build step now runs in-process instead of shelling out to a binary, so it works regardless of where `node_modules` lives. Also added `--debug` flag to both `mastra server deploy` and `mastra studio deploy` for verbose build output.
