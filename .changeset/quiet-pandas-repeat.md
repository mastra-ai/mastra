---
'@mastra/memory': minor
---

Added `instructionMode` to observational memory configuration, so an adopter whose domain
differs from the built-in guidance can substitute it rather than argue with it.

`observation.instruction` and `reflection.instruction` were append-only: they land at the end
of a large built-in prompt whose extraction taxonomy and worked examples are fixed. Appending
cannot subtract, so a custom instruction that contradicts a default leaves both in the same
prompt and the model resolves the conflict non-deterministically.

`instructionMode: 'replace'` substitutes the built-in extraction guidance (or, for the
Reflector, the consolidation policy). Observational memory keeps the persona, output format,
and guidelines, so the parsing contract is unchanged — the caller decides *what* to extract
and OM decides how the result is shaped. The Reflector is also now told the extraction guidance
the Observer is actually running under, instead of always describing the defaults.

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    observationalMemory: {
      observation: {
        instruction: 'Track entity IDs and the lifecycle state of every tool result.',
        instructionMode: 'replace',
      },
    },
  },
});
```

Defaults are unchanged and `instructionMode` is ignored when `instruction` is unset.
