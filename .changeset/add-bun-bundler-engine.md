---
'@mastra/bundler-bun': minor
'@mastra/core': minor
'@mastra/deployer': minor
---

Add pluggable bundler engine system with Bun support.

**New Package: `@mastra/bundler-bun`**

A new bundler engine that uses Bun's native `Bun.build()` for faster build times:

```typescript
import { Mastra } from '@mastra/core';
import { createBunEngine } from '@mastra/bundler-bun';

export const mastra = new Mastra({
  bundler: {
    engine: createBunEngine(),
  },
});
```

**Core Changes (`@mastra/core`)**

Added `BundlerEngine` interface to allow custom bundler implementations:

```typescript
import type { BundlerEngine } from '@mastra/core/bundler';
```

**Deployer Changes (`@mastra/deployer`)**

- Added `createBunServer()` - uses Bun's native `Bun.serve()` for better performance on Bun runtime
- Added `createServer()` - auto-detects runtime and uses appropriate server
- Added `RollupBundlerEngine` export via `@mastra/deployer/engines`

```typescript
import { createServer, createBunServer } from '@mastra/deployer/server';
import { createRollupEngine } from '@mastra/deployer/engines';
```
