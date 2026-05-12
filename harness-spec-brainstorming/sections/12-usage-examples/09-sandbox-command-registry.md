### 12.9 Sandbox command policy

```ts
import { LocalSandbox } from '@mastra/core/workspace';

const sandbox = new LocalSandbox({
  commandPolicy: 'restricted',
  commands: {
    npm: { description: 'npm CLI' },
    gh: { description: 'GitHub CLI' },
    git: { description: 'Git CLI, available read-only' },
  },
});

// The portable v1 policy is a static command-start allowlist. Provider-specific
// programmable registries, custom executors, and per-command env injection are
// outside the v1 sandbox policy surface.
```
