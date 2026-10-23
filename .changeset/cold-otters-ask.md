---
'@mastra/react': minor
---

Added saved views hooks in `@mastra/react/hooks/saved-views`: `useSavedViews({ page })`, `useCreateSavedView`, `useUpdateSavedView`, `useDeleteSavedView`, and `isSavedViewsUnavailableError` to hide saved views when the server can't serve them (404 or 501). `useSavedViews` returns every view for the page, fetching each page of 100 in turn.

```tsx
import { isSavedViewsUnavailableError, useSavedViews } from '@mastra/react/hooks/saved-views';

const { data: views = [], error } = useSavedViews({ page: 'traces' });
if (isSavedViewsUnavailableError(error)) return null;
```
