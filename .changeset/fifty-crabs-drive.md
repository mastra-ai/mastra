---
'@mastra/client-js': minor
'@mastra/deployer': minor
'@mastra/server': minor
---

Add observeStream support for agent-builder template installation

- Add observeStream, observeStreamVNext, observeStreamLegacy, and resumeStream methods to agent-builder client SDK
- Add corresponding server handlers and deployer routes for observe streaming
- Add tracingOptions parameter to existing agent-builder handlers for parity with workflows
- Update template installation processor to support both legacy and VNext streaming event formats
