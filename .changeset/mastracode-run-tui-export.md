---
'mastracode': patch
---

Added a `mastracode/run-tui` export so a launcher can start the Mastra Code TUI with extra session options, such as Knowledge and its scopes:

```ts
import { runTui } from 'mastracode/run-tui';

await runTui({ createMastraCode: { knowledge: { key: 'team', instance: knowledge }, scopes: ['org:acme'] } });
```

Options given here replace the values Mastra Code would pass for the same keys, and apply to the interactive local TUI only. The `mastracode` command behaves as before.
