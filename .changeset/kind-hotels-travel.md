---
'@mastra/core': patch
---

Expand `processInputStep` processor method and integrate `prepareStep` as a processor

**New Features:**
- `prepareStep` callback now runs through the standard `processInputStep` pipeline
- Processors can now modify per-step: `model`, `tools`, `toolChoice`, `activeTools`, `messages`, `systemMessages`, `providerOptions`, `modelSettings`, and `structuredOutput`
- Processor chaining: each processor receives accumulated state from previous processors
- System messages are isolated per-step (reset at start of each step)

**Breaking Change:**
- `prepareStep` messages format changed from AI SDK v5 model messages to `MastraDBMessage` format
- Migration: Use `messageList.get.all.aiV5.model()` if you need the old format
