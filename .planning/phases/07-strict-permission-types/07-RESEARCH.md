# Phase 7: Strict Permission Types - Research

**Researched:** 2026-01-30
**Domain:** TypeScript literal types and const assertions
**Confidence:** HIGH

## Summary

This phase adds strict typing to `RoleDefinition.permissions` to catch invalid permission strings at compile time. The existing codebase already has the foundation: `STUDIO_PERMISSIONS` uses `as const` and `StudioPermission` type is derived using `(typeof STUDIO_PERMISSIONS)[number]`.

The key challenge is wildcard support. DEFAULT_ROLES uses permissions like `'*'`, `'studio:*'`, `'agents:*'` which are NOT explicit members of STUDIO_PERMISSIONS. The solution is to create a union type that includes both explicit permissions AND wildcard patterns.

**Primary recommendation:** Create a `Permission` type that is a union of `StudioPermission`, the global wildcard `'*'`, and resource wildcards `'${Resource}:*'`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type extraction via `as const` | Native TS feature, no deps |

### Supporting
No additional libraries needed - this is pure TypeScript type manipulation.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Template literal wildcards | Regex-validated strings | Template literals are compile-time, regex is runtime |
| Union type | Branded string type | Union provides autocomplete, branded loses it |

## Architecture Patterns

### Pattern 1: Const Array Type Extraction

**What:** Extract union type from const array using indexed access
**When to use:** When you have a fixed set of valid values defined as an array
**Example:**
```typescript
// Source: packages/core/src/ee/defaults/roles.ts (existing)
export const STUDIO_PERMISSIONS = [
  'studio:read',
  'studio:write',
  // ...
] as const;

export type StudioPermission = (typeof STUDIO_PERMISSIONS)[number];
// Results in: 'studio:read' | 'studio:write' | ...
```

### Pattern 2: Template Literal Wildcards

**What:** Use template literal types to create wildcard patterns
**When to use:** When you need pattern-based types derived from existing types
**Example:**
```typescript
// Extract resources from existing permissions
type Resource = StudioPermission extends `${infer R}:${string}` ? R : never;
// Results in: 'studio' | 'agents' | 'workflows' | 'memory' | 'tools' | 'logs' | 'users' | 'settings'

// Create resource wildcard type
type ResourceWildcard = `${Resource}:*`;
// Results in: 'studio:*' | 'agents:*' | 'workflows:*' | ...

// Final permission type
type Permission = StudioPermission | '*' | ResourceWildcard;
```

### Pattern 3: Overloaded Interface (Backward Compatibility)

**What:** Generic interface with optional strict type parameter
**When to use:** When migrating from loose to strict types without breaking consumers
**Example:**
```typescript
// Before (current)
export interface RoleDefinition {
  permissions: string[];
}

// After (option A - strict with escape hatch)
export interface RoleDefinition<P extends string = Permission> {
  permissions: P[];
}

// After (option B - just strict, simpler)
export interface RoleDefinition {
  permissions: Permission[];
}
```

### Recommended Project Structure
```
packages/core/src/ee/
├── defaults/
│   └── roles.ts           # STUDIO_PERMISSIONS, StudioPermission, Permission types
├── interfaces/
│   └── rbac.ts           # RoleDefinition uses Permission type
```

### Anti-Patterns to Avoid
- **Don't widen to string during iteration:** `permissions.forEach(p => ...)` may widen type to string - use explicit type annotations
- **Don't mix const and mutable arrays:** Once extracted as literal type, keep array readonly

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission validation | Custom validation function | TypeScript literal types | Compile-time vs runtime |
| Enum-like permissions | Actual enum | `as const` array | Arrays are iterable, enums need Object.values() |
| Wildcard matching | Complex type guards | Template literal inference | Type-level pattern matching |

**Key insight:** TypeScript's type system can encode the entire permission structure. No runtime validation needed for permission string validity - the compiler catches it.

## Common Pitfalls

### Pitfall 1: RoleMapping Still Uses string[]

**What goes wrong:** RoleMapping values are `string[]`, not `Permission[]`
**Why it happens:** RoleMapping is designed for external provider roles which are arbitrary strings
**How to avoid:** Keep `RoleMapping` as `string[]` - it's intentionally loose for external providers. Only `RoleDefinition.permissions` should be strict.
**Warning signs:** Trying to make RoleMapping strict will break WorkOS, Clerk, etc. integrations

### Pitfall 2: resolvePermissions Returns string[]

**What goes wrong:** Functions like `resolvePermissions()` return `string[]`, losing type info
**Why it happens:** Permissions accumulate in a Set, then convert to Array
**How to avoid:** Change return type to `Permission[]` and use type assertions where Set conversion happens
**Warning signs:** Downstream code getting `string[]` instead of `Permission[]`

### Pitfall 3: Wildcard ID Patterns Not Covered

**What goes wrong:** Permissions like `agents:read:my-agent` (with resource ID) won't type-check
**Why it happens:** We only define `resource:action` patterns, not `resource:action:id`
**How to avoid:** Add template literal for ID patterns: `${StudioPermission}:${string}`
**Warning signs:** TypeScript errors when using resource-specific permissions

### Pitfall 4: Public API Breaking Change

**What goes wrong:** External code defining custom RoleDefinition fails to compile
**Why it happens:** Changing `permissions: string[]` to `permissions: Permission[]` is breaking
**How to avoid:** Option A: Use generic with default. Option B: Accept breaking change (minor version bump)
**Warning signs:** Downstream packages fail typecheck after upgrade

## Code Examples

### Extract Resource Type from Permissions
```typescript
// Source: TypeScript template literal type inference
type Resource = StudioPermission extends `${infer R}:${string}` ? R : never;
// Extracts: 'studio' | 'agents' | 'workflows' | 'memory' | 'tools' | 'logs' | 'users' | 'settings'
```

### Complete Permission Type Definition
```typescript
// Source: Derived from existing patterns in roles.ts
import type { STUDIO_PERMISSIONS } from './roles';

export type StudioPermission = (typeof STUDIO_PERMISSIONS)[number];

// Extract resource names from permissions
type Resource = StudioPermission extends `${infer R}:${string}` ? R : never;

// Wildcard patterns
type ResourceWildcard = `${Resource}:*`;
type ResourceActionId = `${StudioPermission}:${string}`;

// Full permission type
export type Permission =
  | StudioPermission           // 'studio:read', 'agents:write', etc.
  | '*'                        // Global wildcard
  | ResourceWildcard           // 'studio:*', 'agents:*', etc.
  | ResourceActionId;          // 'agents:read:my-agent', etc.
```

### Updated RoleDefinition Interface
```typescript
// Source: packages/core/src/ee/interfaces/rbac.ts (to be updated)
export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];  // Changed from string[]
  inherits?: string[];
}
```

### Updated resolvePermissions Return Type
```typescript
// Source: packages/core/src/ee/defaults/roles.ts (to be updated)
export function resolvePermissions(
  roleIds: string[],
  roles: RoleDefinition[] = DEFAULT_ROLES
): Permission[] {  // Changed from string[]
  const permissions = new Set<Permission>();
  // ...
  return Array.from(permissions);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String enums | `as const` arrays | TypeScript 3.4 (2019) | Better DX, iterable |
| Manual union types | Template literal inference | TypeScript 4.1 (2020) | Auto-derive from patterns |

**Deprecated/outdated:**
- String enums: Still work but `as const` is preferred for permission-like data

## Open Questions

1. **Breaking change tolerance?**
   - What we know: Changing `string[]` to `Permission[]` is technically breaking
   - What's unclear: Are external consumers defining custom RoleDefinitions?
   - Recommendation: Start with strict type, accept it as minor breaking change since this is EE code with limited external consumers

2. **Should RoleMapping be strict too?**
   - What we know: RoleMapping is for external provider roles (WorkOS, Clerk)
   - What's unclear: N/A - it's intentionally loose
   - Recommendation: Keep RoleMapping as `string[]` - it maps external roles to permissions

## Sources

### Primary (HIGH confidence)
- TypeScript Handbook: Literal Types - https://www.typescriptlang.org/docs/handbook/literal-types.html
- Existing codebase: `packages/core/src/ee/defaults/roles.ts` - verified `as const` and type extraction pattern

### Secondary (MEDIUM confidence)
- TypeScript 4.1 Release Notes - Template literal types
- Community patterns for const arrays - https://www.bscotch.net/post/typescript-as-const

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure TypeScript, verified in existing codebase
- Architecture: HIGH - Pattern already exists in roles.ts
- Pitfalls: HIGH - Analyzed from actual codebase usage patterns

**Research date:** 2026-01-30
**Valid until:** 90 days (TypeScript type features are stable)
