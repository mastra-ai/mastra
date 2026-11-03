---
'@mastra/core': patch
---

Fixed `writer` being undefined in `processOutputResult` for agents wrapped with `createDurableAgent` or `createEventedAgent`. Chunks written with `writer.custom()` now stream before `finish`, and non-transient chunks are saved with the reply, as with a regular `Agent`. Fixes [#29213](https://github.com/mastra-ai/mastra/issues/29213).
