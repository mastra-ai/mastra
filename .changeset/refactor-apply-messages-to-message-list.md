---
'@mastra/core': patch
---

Refactor: consolidate duplicate applyMessages helpers in workflow.ts

- Added optional `defaultSource` parameter to `ProcessorRunner.applyMessagesToMessageList` to support both 'input' and 'response' default sources
- Removed 3 duplicate inline `applyMessages` helper functions from workflow.ts (in input, outputResult, and outputStep phases)
- All phases now use the shared `ProcessorRunner.applyMessagesToMessageList` static method

This is an internal refactoring with no changes to external behavior.
