---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system-routed agent processors. Place input and output processor files under `agents/<name>/processors/input/` and `agents/<name>/processors/output/`. Each file default-exports a processor, and they are auto-discovered and merged with config-defined processors when running `mastra dev` or `mastra build`. Config-defined processors run first, and a dynamic (function) `inputProcessors`/`outputProcessors` in `config.ts` takes precedence over discovered files.

```
src/mastra/agents/support/
├── config.ts
├── instructions.md
└── processors/
    ├── input/
    │   └── moderation.ts
    └── output/
        └── redact-pii.ts
```

```ts
// src/mastra/agents/support/processors/input/moderation.ts
import { ModerationProcessor } from '@mastra/core/processors';

export default new ModerationProcessor({ model: 'openai/gpt-5-nano' });
```
