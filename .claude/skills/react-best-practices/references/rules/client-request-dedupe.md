---
title: Use TanStack Query for Automatic Deduplication
impact: MEDIUM-HIGH
impactDescription: automatic deduplication
tags: client, tanstack-query, deduplication, data-fetching
---

## Use TanStack Query for Automatic Deduplication

TanStack Query enables request deduplication, caching, and revalidation across component instances.

**Incorrect (no deduplication, each instance fetches):**

```tsx
function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers);
  }, []);
}
```

**Correct (multiple instances share one request):**

```tsx
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
  });
}
```

**For immutable data:**

```tsx
import { useQuery } from '@tanstack/react-query';

function StaticContent() {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
    staleTime: Infinity,
  });
}
```

**For mutations:**

```tsx
import { useMutation } from '@tanstack/react-query';

function UpdateButton() {
  const { mutate } = useMutation({
    mutationFn: updateUser,
  });
  return <button onClick={() => mutate()}>Update</button>;
}
```

**For dependent params in custom hooks:**

If callers often pass `id ?? ''` with `enabled: Boolean(id)`, the hook input should be `id?: string | null`. Callers should pass the real value, not a fake empty string:

```tsx
useProject(projectId);
```

Choose the guard based on behavior:

- Use `skipToken` when the query should not exist until the required param exists, and no caller needs manual `refetch()` while the param is missing.
- Use `enabled` plus a runtime guard when callers need `refetch()` to keep working.
- Keep the guard local to the hook. Do not add a generic wrapper/helper unless several hooks repeat the same shape; it can hide the query key, query function, and refetch tradeoff.

**Type-safe dependent query:**

```tsx
import { skipToken, useQuery } from '@tanstack/react-query';

function useProject(projectId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: projectId ? () => fetchProject(projectId) : skipToken,
    enabled,
  });
}
```

**Manual refetch-compatible query:**

```tsx
import { useQuery } from '@tanstack/react-query';

function useProject(projectId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (!projectId) throw new Error('Missing projectId');
      return fetchProject(projectId);
    },
    enabled: enabled && Boolean(projectId),
  });
}
```

Keep strict hooks strict: if the hook type is `id: string`, callers must pass a real id.

References:

- [https://tanstack.com/query](https://tanstack.com/query)
- [https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries#typesafe-disabling-of-queries-using-skiptoken](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries#typesafe-disabling-of-queries-using-skiptoken)
- [https://tkdodo.eu/blog/react-query-and-type-script#type-safety-with-the-enabled-option](https://tkdodo.eu/blog/react-query-and-type-script#type-safety-with-the-enabled-option)
