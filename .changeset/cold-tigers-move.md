---
'@mastra/core': minor
'mastracode': patch
---

Added `createCodingAgent` factory and a reusable `buildBasePrompt` so other projects can build a coding agent on top of the same defaults MastraCode uses.

The factory wires sensible, portable defaults that you can override per field:

- **Workspace** — a local filesystem + sandbox rooted at `process.cwd()` (set `workspaceBasePath`, pass your own `workspace`, or pass `workspace: undefined` to opt out entirely).
- **Task signals** — `TaskSignalProvider` so a task list persists across turns.
- **Error handling** — retries on `ECONNRESET` and bad-request errors, plus prefill and provider-history compatibility processors.
- **Goal judging** — the default goal judge prompt.

`buildBasePrompt` is parameterized with `productName` and `coAuthorName` (both default to "Mastra Code"), so you can brand the system prompt without forking it.

```ts
import { createCodingAgent } from '@mastra/core/coding-agent';

const agent = createCodingAgent({
  instructions: 'You help with my project.',
  model: myModel,
  workspaceBasePath: '/path/to/repo',
});
```
