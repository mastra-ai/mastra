---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Add Mastra package version display to Studio sidebar

- CLI now extracts installed Mastra packages and their resolved versions from the project's package.json and node_modules
- New `/api/system/packages` endpoint returns the list of installed Mastra packages
- Client SDK adds `getSystemPackages()` method
- Studio sidebar displays the mastra version with an expandable list showing all installed @mastra/\* packages and their versions, with copy-to-clipboard support
