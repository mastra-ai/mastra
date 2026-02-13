# Plan: Permission Denied UI Component

---
wave: 1
depends_on: []
files_modified:
  - packages/playground-ui/src/ds/components/PermissionDenied/PermissionDenied.tsx
  - packages/playground-ui/src/ds/components/PermissionDenied/index.ts
  - packages/playground-ui/src/index.ts
autonomous: true
---

## Goal

Create a reusable `PermissionDenied` component for displaying 403 RBAC errors.

## Context

When a user lacks permission to access a resource, we need a clear UI component.
This follows the existing `EmptyState` pattern in the design system.

## Tasks

<task id="1">
Create `packages/playground-ui/src/ds/components/PermissionDenied/PermissionDenied.tsx`:

```typescript
import * as React from 'react';
import { ShieldX } from 'lucide-react';
import { EmptyState } from '../EmptyState';
import { Icon } from '../../icons/Icon';

export interface PermissionDeniedProps {
  /** Resource type (e.g., "agents", "workflows") */
  resource?: string;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Optional action slot (e.g., contact admin button) */
  actionSlot?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function PermissionDenied({
  resource,
  title,
  description,
  actionSlot,
  className,
}: PermissionDeniedProps) {
  const defaultTitle = 'Permission Denied';
  const defaultDescription = resource
    ? `You don't have permission to access ${resource}. Contact your administrator for access.`
    : "You don't have permission to access this resource. Contact your administrator for access.";

  return (
    <EmptyState
      className={className}
      iconSlot={
        <Icon size="lg" className="text-neutral3">
          <ShieldX />
        </Icon>
      }
      titleSlot={title ?? defaultTitle}
      descriptionSlot={description ?? defaultDescription}
      actionSlot={actionSlot}
    />
  );
}
```
</task>

<task id="2">
Create `packages/playground-ui/src/ds/components/PermissionDenied/index.ts`:

```typescript
export { PermissionDenied } from './PermissionDenied';
export type { PermissionDeniedProps } from './PermissionDenied';
```
</task>

<task id="3">
Export from `packages/playground-ui/src/index.ts`:

Add export:
```typescript
export * from './ds/components/PermissionDenied';
```
</task>

## Verification

```bash
# TypeScript compiles
cd packages/playground-ui && pnpm build
```

## must_haves

- [ ] PermissionDenied component renders with ShieldX icon
- [ ] Component accepts resource prop for contextual messages
- [ ] Component exported from package index
