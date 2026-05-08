### 12.9 Sandbox command registry

```ts
import { LocalSandbox } from '@mastra/core/workspace';

const sandbox = new LocalSandbox({
  commandPolicy: 'restricted',
  commands: {
    npm: null, // bare allow — no env, no custom executor
    gh: { env: { GH_TOKEN: process.env.GH_TOKEN } },
    git: { description: 'Git CLI, available read-only', env: { GIT_TERMINAL_PROMPT: '0' } },
  },
});

// Programmatic: register at runtime.
sandbox.defineCommand('deploy', {
  execute: async (args, opts) => {
    // Custom executor — could call an internal API, mock for tests, etc.
    const result = await deployService.run(args);
    return { stdout: result.log, stderr: '', exitCode: result.code };
  },
  description: 'Trigger an internal deploy. Args: <env> <service>',
});
```
