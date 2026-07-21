---
'@mastra/core': patch
---

Fixed dataset item writes to reject circular payloads with a clear validation error before storage, instead of failing with database-specific serialization errors. Silently lossy JSON values (nested `undefined`, functions, symbols, bigints, and non-finite numbers) and non-plain objects (`Date`, `Map`, `Set`, class instances, and custom `toJSON()` objects) are now also rejected with the offending path, so identical `externalId` retries can no longer conflict with the persisted payload. Added a public `safeStringify` utility for serializing values that may contain circular references.

```ts
import { safeStringify, ensureSerializable } from '@mastra/core/utils/safe-stringify';

const value: Record<string, unknown> = { prompt: 'hello' };
value.self = value;

safeStringify(value); // '{"prompt":"hello","self":"[Circular]"}'
ensureSerializable(value); // { prompt: 'hello', self: '[Circular]' }
```
