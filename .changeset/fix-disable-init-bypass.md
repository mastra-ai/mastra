---
'mastra': patch
'@mastra/deployer-cloud': patch
---

Fixed `mastra build` ignoring `disableInit: true` — the built server no longer runs CREATE TABLE / ALTER TABLE statements on startup when `disableInit` is set. ([#13570](https://github.com/mastra-ai/mastra/issues/13570))
