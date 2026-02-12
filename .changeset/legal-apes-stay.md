---
'mastra': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Fixed CMS features (Create an agent button, clone, edit, create scorer) not appearing in built output. The build command now writes package metadata so the studio can detect installed Mastra packages at runtime.

The version footer in the sidebar now only displays in dev mode, keeping built studio output clean.
