---
'@mastra/core': minor
---

Added agent-level skills: attach skills directly to an Agent without a Workspace via `createSkill()` and the new `skills` config property.

**New `skills` property on Agent config**

```typescript
import { Agent } from '@mastra/core/agent';
import { createSkill } from '@mastra/core/skills';

const agent = new Agent({
  id: 'reviewer',
  model: openai('gpt-4o'),
  instructions: 'You are a code review assistant.',
  skills: [
    './skills/review', // filesystem path
    createSkill({
      // inline — no filesystem needed
      name: 'release-checklist',
      description: 'Use when preparing a release.',
      instructions: '## Release Checklist\n1. Run tests...',
    }),
  ],
});
```

**Key features:**

- `createSkill()` factory for code-defined skills with validation
- Filesystem paths and inline skills can be mixed in the same array
- Dynamic skill resolution via function: `skills: (ctx) => [...]`
- When both `skills` and `workspace.skills` exist, they merge (agent-level wins on conflicts)
- `agent.getSkill(name)` and `agent.listSkills()` public API for programmatic access
- New `@mastra/core/skills` export path
