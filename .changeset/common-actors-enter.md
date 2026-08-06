---
'mastracode': minor
---

Plugins installed with `/plugins` can now contribute processors and signal providers, not just tools, commands, skills, and instructions. Author them against `mastracode/plugin` with the new `processors` and `signalProviders` fields:

```ts
import { defineMastraCodePlugin } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: 'acme.signals',
  processors: { input: [auditLog], output: [redactSecrets] },
  signalProviders: [new AcmeSignals()],
});
```
