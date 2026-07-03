---
'@mastra/deployer': minor
'mastra': patch
---

When no index.ts exists in the mastra directory and file-based primitives are found, the bundler auto-constructs a Mastra instance from discovered agents, workflows, storage, observability, server, and studio files. Users can now fully embrace the file-based paradigm without writing any boilerplate.
