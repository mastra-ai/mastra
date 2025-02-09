# @mastra/vector-vectorize (DEPRECATED)

⚠️ **This package is deprecated** ⚠️

This package has been moved to `@mastra/vectorize`. Please update your dependencies and imports to use the new package:

```diff
- import { CloudflareVector } from '@mastra/vector-vectorize';
+ import { CloudflareVector } from '@mastra/vectorize';
```

## Migration

1. Update your package.json:

```diff
- "@mastra/vector-vectorize": "^0.1.0"
+ "@mastra/vectorize": "^0.1.0"
```

2. Update your imports:

```diff
- import { CloudflareVector } from '@mastra/vector-vectorize';
+ import { CloudflareVector } from '@mastra/vectorize';
```

3. Run `pnpm install` to update your dependencies

The API remains the same, so no other changes are needed.

## Why was this moved?

This package was moved to simplify our package naming convention and improve discoverability. The new package is functionally identical but lives in a more appropriate location in our monorepo structure.
