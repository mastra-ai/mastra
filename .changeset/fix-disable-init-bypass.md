---
'mastra': patch
'@mastra/deployer-cloud': patch
---

Fixed `disableInit: true` being ignored on `mastra build`. The generated server entry point was unconditionally calling `storage.init()`, executing CREATE TABLE and ALTER TABLE statements on startup even when `disableInit` was set. The entry point now checks `storage.disableInit` before triggering initialization. ([#13570](https://github.com/mastra-ai/mastra/issues/13570))
