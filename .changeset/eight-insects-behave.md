---
'@mastra/server': minor
---

Added `isZodError` helper and `ZodErrorLike` type, exported from `@mastra/server/server-adapter` (and `@mastra/server/handlers/error`). Use these instead of `instanceof ZodError` when handling validation errors in custom server adapters or middleware so the check survives consumers that pin a different `zod` package instance than the one bundled with `@mastra/server`.

```ts
import { isZodError } from '@mastra/server/server-adapter';

try {
  await schema.parseAsync(input);
} catch (error) {
  if (isZodError(error)) {
    // structural check — works across zod v3/v4 realms
    return formatValidationError(error);
  }
  throw error;
}
```

Underpins the fix for [#17167](https://github.com/mastra-ai/mastra/issues/17167).
