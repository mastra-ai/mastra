---
'@mastra/playground-ui': minor
---

**Breaking for consumers of the `components/*` subpaths:** `ErrorState`, `PermissionDenied` and `SessionExpired` are gone. They were `EmptyState` with a different icon and two sentences, so their copy now lives in `QueryError`, which turns a failed query into the right state:

```tsx
// before
if (is401UnauthorizedError(error)) return <SessionExpired />;
if (is403ForbiddenError(error)) return <PermissionDenied resource="tools" />;
return <ErrorState title="Failed to load tools" message={error.message} />;

// after
<QueryError error={error} resource="tools" title="Failed to load tools" />;
```

For a state that is not a query failure, compose `EmptyState` directly and pass your own icon and copy. `isAuthError` is exported alongside the existing status predicates for the pages that only want to catch 401 and 403.
