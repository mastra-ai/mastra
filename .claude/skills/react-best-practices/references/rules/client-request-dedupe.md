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

A param is either the value or `undefined` — never add `| null` as a third absence type, and never pass a fake value like `id ?? ''` to satisfy the signature.

Prefer keeping the hook strict (`id: string`) and narrowing at the caller: the component that reads the raw param guards first, and only renders the child that calls the hook once the param exists. If the param is missing, the query should not exist at all.

```tsx
function ProjectPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;

  if (!projectId) return <Navigate to="/projects" />;

  return <ProjectDetail projectId={projectId} />;
}

function ProjectDetail({ projectId }: { projectId: string }) {
  // The hook input stays `string`; loading/error are owned here —
  // see structure-early-return-render-branches.
  const { data, isLoading, error } = useProject(projectId);
  // ...
}

function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
  });
}
```

When the component must stay mounted before the param exists (e.g. the query is gated by another flag), widen the input to `id?: string` and guard the query function with `skipToken` — never a non-null assertion:

```tsx
import { skipToken, useQuery } from '@tanstack/react-query';

function useProject(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: projectId ? () => fetchProject(projectId) : skipToken,
    enabled,
  });
}
```

`skipToken` disables manual `refetch()` while the param is missing; if a caller needs `refetch()` in that window, narrow at the caller instead of weakening the hook.

Keep strict hooks strict: if the hook type is `id: string`, callers must pass a real id.

References:

- [https://tanstack.com/query](https://tanstack.com/query)
- [https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries#typesafe-disabling-of-queries-using-skiptoken](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries#typesafe-disabling-of-queries-using-skiptoken)
- [https://tkdodo.eu/blog/react-query-and-type-script#type-safety-with-the-enabled-option](https://tkdodo.eu/blog/react-query-and-type-script#type-safety-with-the-enabled-option)
