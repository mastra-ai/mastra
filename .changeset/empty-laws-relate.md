---
'@mastra/core': patch
---

Fixed a nested workflow overwriting parent state that another step changed while it ran. When a nested workflow ran inside `.parallel()` or `.foreach()` and its `stateSchema` filled in a default or transformed a value, that value replaced whatever the other step had written to the same key. The nested workflow now hands back only the values its own steps changed. Fixes [#29347](https://github.com/mastra-ai/mastra/issues/29347).
