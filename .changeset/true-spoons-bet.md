---
'@mastra/playground-ui': patch
'@mastra/react': patch
'@mastra/core': patch
---

fix: persist data-* chunks from writer.custom() to memory storage

- Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
- Data chunks are now saved to message storage so they survive page refreshes
- Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
- Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
- Update related `@assistant-ui/*` packages for compatibility
