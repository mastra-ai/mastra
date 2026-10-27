---
'@mastra/code-sdk': minor
'mastracode': patch
---

Mastra Code no longer registers subagents unless you turn them on. `createMastraCode()` and `mountAgentControllerOnMastra()` now default `subagents` to an empty list. To get the explore, plan and execute subagents back, pass `builtinSubagents`:

```ts
import { builtinSubagents, createMastraCode } from '@mastra/code-sdk';

await createMastraCode({ subagents: [...builtinSubagents] });
```

The TUI, headless `mastracode --prompt` runs and ACP sessions all read the `subagentsEnabled` setting (toggled with `/subagents`, off by default), so subagents only run when a user opts in.
