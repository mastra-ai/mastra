---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added browser-safe thinking command helpers so Mastra Code interfaces can share command parsing, model capabilities, and default resolution.

```ts
import { parseThinkCommand, resolveDefaultThinkingLevel } from '@mastra/code-sdk/thinking';

const action = parseThinkCommand('high');
const fallback = resolveDefaultThinkingLevel({ globalDefault: 'medium', modeDefaults: { plan: 'high' } }, 'plan');
```
