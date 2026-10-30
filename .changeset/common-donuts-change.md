---
'@mastra/core': patch
---

Fixed `@mastra/core/loop/server` failing to load with a module-not-found error. The `createRunCommandTool` export is now importable at runtime. Also removed the `@mastra/core/network/vNext` and `@mastra/core/telemetry/otel-vendor` subpaths, which pointed to files that no longer ship. Fixes [#29014](https://github.com/mastra-ai/mastra/issues/29014).
