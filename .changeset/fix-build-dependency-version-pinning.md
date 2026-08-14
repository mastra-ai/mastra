---
'@mastra/deployer': patch
---

Fixed `mastra build` pinning the wrong dependency version when the app and its parent workspace install different copies. The build now starts package lookup from the app directory, so the generated `.mastra/output/package.json` uses the app's installed version and the deployed server starts correctly.
