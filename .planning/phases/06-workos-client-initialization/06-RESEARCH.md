# Phase 6: WorkOS Client Initialization - Research

**Researched:** 2026-01-30
**Domain:** TypeScript refactoring - constructor pattern alignment
**Confidence:** HIGH

## Summary

This phase requires refactoring `MastraRBACWorkos` to initialize the WorkOS client internally, matching the pattern already established in `MastraAuthWorkos`. The current implementation requires a pre-instantiated `WorkOS` client to be passed in, which creates inconsistency and forces users to manage WorkOS client creation themselves.

The refactoring is straightforward: extract the WorkOS initialization pattern from `MastraAuthWorkos` and apply it to `MastraRBACWorkos`. Both classes will accept the same config options (`apiKey`, `clientId`) and create the WorkOS client internally.

**Primary recommendation:** Copy the WorkOS client initialization logic from `MastraAuthWorkos.constructor()` lines 67-99 into `MastraRBACWorkos.constructor()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @workos-inc/node | ^8.0.0 | WorkOS API client | Already in use, official SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lru-cache | ^11.1.0 | Permission caching | Already in MastraRBACWorkos |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Internal init | External WorkOS instance | Current approach - inconsistent API, more user burden |

**Installation:** No new dependencies required.

## Architecture Patterns

### Current MastraAuthWorkos Initialization Pattern
```typescript
// Source: auth/workos/src/auth-provider.ts lines 67-99
const apiKey = options?.apiKey ?? process.env.WORKOS_API_KEY;
const clientId = options?.clientId ?? process.env.WORKOS_CLIENT_ID;

if (!apiKey || !clientId) {
  throw new Error(
    'WorkOS API key and client ID are required. ' +
      'Provide them in the options or set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
  );
}

this.workos = new WorkOS(apiKey, { clientId });
```

### Current MastraRBACWorkos Pattern (to be changed)
```typescript
// Source: auth/workos/src/rbac-provider.ts line 94
constructor(options: MastraRBACWorkosFullOptions) {
  this.workos = options.workos;  // Requires pre-instantiated client
  // ...
}
```

### Target Pattern for MastraRBACWorkos
```typescript
// Internal initialization like MastraAuthWorkos
constructor(options: MastraRBACWorkosOptions) {
  const apiKey = options.apiKey ?? process.env.WORKOS_API_KEY;
  const clientId = options.clientId ?? process.env.WORKOS_CLIENT_ID;

  if (!apiKey || !clientId) {
    throw new Error(
      'WorkOS API key and client ID are required. ' +
        'Provide them in the options or set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
    );
  }

  this.workos = new WorkOS(apiKey, { clientId });
  this.options = options;
  // ... rest of initialization
}
```

### WorkOS Constructor Signature
```typescript
// Source: @workos-inc/node v8.0.0 lib/workos.js lines 86-111
// Two overloads:
new WorkOS(apiKey: string, options?: WorkOSOptions)
new WorkOS(options: WorkOSOptions)

// WorkOSOptions interface:
interface WorkOSOptions {
  apiKey?: string;
  apiHostname?: string;
  https?: boolean;
  port?: number;
  config?: RequestInit;
  appInfo?: AppInfo;
  fetchFn?: typeof fetch;
  clientId?: string;
  timeout?: number;
}
```

### Anti-Patterns to Avoid
- **Requiring external WorkOS instance:** Forces users to manage client creation and understand WorkOS SDK internals
- **Different initialization patterns for related classes:** Creates cognitive overhead and API inconsistency

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WorkOS client creation | Custom factory | Direct WorkOS constructor | Simple, documented pattern |
| API key fallback | Custom env lookup | Existing pattern in MastraAuthWorkos | Already tested and working |

**Key insight:** The initialization pattern is already implemented and tested in MastraAuthWorkos. Reuse it directly.

## Common Pitfalls

### Pitfall 1: Breaking the public API
**What goes wrong:** Removing `workos` from options breaks existing code that passes WorkOS instance
**Why it happens:** Not considering backward compatibility
**How to avoid:** Update `MastraRBACWorkosOptions` type to add `apiKey` and `clientId`, remove `MastraRBACWorkosFullOptions` interface entirely
**Warning signs:** TypeScript errors about missing `workos` property

### Pitfall 2: Inconsistent error messages
**What goes wrong:** Different error messages between MastraAuthWorkos and MastraRBACWorkos for the same validation failure
**Why it happens:** Copy-pasting and modifying error text
**How to avoid:** Use identical error message from MastraAuthWorkos
**Warning signs:** Error messages mentioning different things

### Pitfall 3: Forgetting environment variable support
**What goes wrong:** Only accepting options, not env vars
**Why it happens:** Incomplete pattern copying
**How to avoid:** Include the full fallback chain: `options?.apiKey ?? process.env.WORKOS_API_KEY`
**Warning signs:** Tests fail when using env vars instead of options

### Pitfall 4: Not updating the example in index.ts
**What goes wrong:** Package example code shows old pattern
**Why it happens:** Forgetting documentation
**How to avoid:** Update example in src/index.ts to show new simpler API
**Warning signs:** Example code doesn't compile

## Code Examples

### Before: Current Usage Pattern
```typescript
// Source: auth/workos/src/index.ts lines 19-32
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

const workosAuth = new MastraAuthWorkos({
  apiKey: process.env.WORKOS_API_KEY,
  clientId: process.env.WORKOS_CLIENT_ID,
});

const mastra = new Mastra({
  server: {
    auth: workosAuth,
    rbac: new MastraRBACWorkos({
      workos: workosAuth.getWorkOS(),  // Must get WorkOS instance from auth
      roleMapping: { /* ... */ },
    }),
  },
});
```

### After: Target Usage Pattern
```typescript
// Simplified - no need to share WorkOS instance
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID,
    }),
    rbac: new MastraRBACWorkos({
      apiKey: process.env.WORKOS_API_KEY,  // Direct config, no sharing needed
      clientId: process.env.WORKOS_CLIENT_ID,
      roleMapping: { /* ... */ },
    }),
  },
});
```

### Environment Variable Fallback Pattern
```typescript
// Cleanest usage with env vars
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

// Both classes read from WORKOS_API_KEY and WORKOS_CLIENT_ID env vars
const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos(),  // Uses env vars
    rbac: new MastraRBACWorkos({
      roleMapping: { /* required */ },
    }),
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pass WorkOS instance | Accept config options | This phase | Simpler, consistent API |

**Deprecated/outdated:**
- `MastraRBACWorkosFullOptions` interface: Will be removed, options merged into `MastraRBACWorkosOptions`

## Open Questions

1. **Should we support both patterns?**
   - What we know: Could accept either WorkOS instance OR config options
   - What's unclear: Whether backward compatibility matters
   - Recommendation: Clean break - remove WorkOS instance option entirely, phase is explicitly about changing API

2. **Should apiKey and clientId be required or optional in MastraRBACWorkosOptions?**
   - What we know: MastraAuthWorkos requires them (throws if missing)
   - What's unclear: Whether to allow fallback to env vars without explicit options
   - Recommendation: Make optional in TypeScript type, throw at runtime if missing (same as MastraAuthWorkos)

## Sources

### Primary (HIGH confidence)
- `auth/workos/src/auth-provider.ts` - Reference implementation
- `auth/workos/src/rbac-provider.ts` - Current implementation to modify
- `auth/workos/src/types.ts` - Type definitions to update
- `@workos-inc/node` v8.0.0 - WorkOS SDK constructor signature

### Secondary (MEDIUM confidence)
- `auth/workos/src/index.ts` - Package documentation/examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - already in codebase
- Architecture: HIGH - copying existing pattern
- Pitfalls: HIGH - based on code analysis

**Research date:** 2026-01-30
**Valid until:** 90 days (stable refactoring, no external dependencies changing)
