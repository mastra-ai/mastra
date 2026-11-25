---
'@mastra/core': minor
---

Exported `PROVIDER_FAILURE_KINDS` from `@mastra/core/error`, the list of values `ProviderFailureKind` can take, so a stored failure kind can be checked at runtime.

```ts
import { PROVIDER_FAILURE_KINDS } from '@mastra/core/error';

const isFailureKind = (value: string) => PROVIDER_FAILURE_KINDS.some(kind => kind === value);
```
