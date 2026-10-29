---
'@mastra/code-sdk': minor
'mastracode': patch
---

Mastra Code no longer registers subagents unless you turn them on. `createMastraCode()` and `mountAgentControllerOnMastra()` now default `subagents` to an empty list.

Before, omitting `subagents` registered the explore, plan and execute subagents:

```ts
await createMastraCode();
```

After, pass `builtinSubagents` to keep them:

```ts
import { builtinSubagents, createMastraCode } from '@mastra/code-sdk';

await createMastraCode({ subagents: [...builtinSubagents] });
```

The same applies to `mountAgentControllerOnMastra()`.

The TUI, headless `mastracode --prompt` runs and ACP sessions all read the `subagentsEnabled` setting (toggled with `/subagents`, off by default), so subagents only run when a user opts in.
