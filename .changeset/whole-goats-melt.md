---
'mastra': patch
---

Fixed `mastra dev` and `mastra build` reading `@mastra/*` versions from the monorepo root instead of the app. When an app in a monorepo installs its own versions, the peer-dependency check and Studio now use the app's installed versions, so you no longer get false "Peer dependency version mismatch" warnings.
