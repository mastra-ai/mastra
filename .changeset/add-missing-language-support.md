---
'@mastra/rag': patch
---

Add support for PHP in Language enum

Previously, the Language enum defined PHP, but it was not supported in the `getSeparatorsForLanguage` method. This caused runtime errors when trying to use PHP for code chunking.

This change adds proper separator definitions for PHP, ensuring that PHP defined in the Language enum is now fully supported. PHP has been configured with appropriate separators based on its syntax and common programming patterns (classes, functions, control structures, etc.).

**Before:**

```typescript
import { RecursiveCharacterTransformer, Language } from '@mastra/rag';

const transformer = RecursiveCharacterTransformer.fromLanguage(Language.PHP);
const chunks = transformer.transform(phpCodeDocument);
// Throws: "Language PHP is not supported!"
```

**After:**

```typescript
import { RecursiveCharacterTransformer, Language } from '@mastra/rag';

const transformer = RecursiveCharacterTransformer.fromLanguage(Language.PHP);
const chunks = transformer.transform(phpCodeDocument);
// Successfully chunks PHP code at namespace, class, function boundaries
```

Fixes the issue where using `Language.PHP` would throw "Language PHP is not supported!" error.
