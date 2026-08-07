---
'mastra': patch
---

Fixed experiment workers to:

- emit Platform-compatible protocol version metadata and accepted-event negotiation details
- report a deterministic error when the customer `#mastra` module does not export `mastra`
- install explicitly configured external dependencies that are loaded dynamically at runtime
- disable worker-side persistence and resolve relative project roots
- produce reproducible, relocatable manifests that exclude installed dependencies, temporary build metadata, and source-machine paths, and reject absolute or artifact-escaping symlinks
