---
title: Use undefined for Absence, Not null
impact: HIGH
impactDescription: simpler types, fewer impossible states, and less defensive null checking
tags: types, null, undefined, optional, boundaries
---

## Use undefined for Absence, Not null

Model missing values as `undefined`, not `null`. In TypeScript code, optional props, params, and fields should use `?` or `| undefined`; they should not use `| null`. `null` should almost never appear inside the codebase.

External systems may still emit `null` — REST payloads, database rows, or third-party APIs. Convert those values at the boundary with `?? undefined` and keep internal types null-free. Do not let `null` propagate inward.

**Incorrect (null leaks through the component API):**

```tsx
type UserCardProps = {
  user: User | null;
};

function UserCard({ user }: UserCardProps) {
  if (user === null) return null;

  return <span>{user.name}</span>;
}
```

**Correct (absence is optional/undefined):**

```tsx
type UserCardProps = {
  user?: User;
};

function UserCard({ user }: UserCardProps) {
  if (!user) return null;

  return <span>{user.name}</span>;
}
```

**Incorrect (state starts as null):**

```tsx
const [selectedUser, setSelectedUser] = useState<User | null>(null);
```

**Correct (state starts as undefined):**

```tsx
const [selectedUser, setSelectedUser] = useState<User | undefined>();
```

**Correct (convert null at the boundary):**

```ts
type ApiUser = {
  id: string;
  avatarUrl: string | null;
};

type User = {
  id: string;
  avatarUrl?: string;
};

function fromApiUser(user: ApiUser): User {
  return {
    id: user.id,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}
```

`.find()` already returns `undefined`; do not wrap that result in `null`.

```ts
const selectedUser = users.find(user => user.id === selectedUserId);
```

Legitimate exceptions are narrow boundary cases: an external API requires `null`, a database column distinguishes `null` from missing, or React rendering uses `return null` to render nothing. Keep those cases local and explicit.

## Review Smells

- `| null` in props, hook params, domain types, or component state.
- `useState<T | null>(null)`.
- `=== null` / `!== null` checks outside boundary adapters.
- Returning or storing `null` because a lookup did not find anything.
- Passing `null` through multiple layers instead of converting once with `?? undefined`.
- `null` literals outside boundary adapters, third-party API requirements, DB-specific semantics, or React `return null`.
