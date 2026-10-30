---
'@mastra/playground-ui': minor
---

Added saved views to the Traces, Spans, Threads and Logs pages. A host stores the views by wrapping the page in a `SavedViewsProvider`; without one the pages look as before.

```tsx
import { SavedViewsProvider, SavedViewNameTakenError } from '@mastra/playground-ui/domains/observability/saved-views';

const source = {
  list: page => api.listSavedViews(page),
  create: input => api.createSavedView(input), // throw SavedViewNameTakenError on a duplicate name
  update: (id, patch) => api.updateSavedView(id, patch),
  remove: id => api.deleteSavedView(id),
};

<SavedViewsProvider source={source} queryKeyScope={['project', projectId]}>
  <SpansPage />
</SavedViewsProvider>;
```

Picking a view sets the page URL and columns exactly as setting the same filters, time range and sort by hand would, and saving the page stores what the URL holds. Parts of an older view the page no longer supports are skipped. The Spans and Threads pages show the views above their toolbar; traces hosts place `TracesExplorer.SavedViews` and logs hosts place `LogsSavedViews`.

`useSavedViews` now reports a failed save as `error` (was `storageError`), and `SavedViewEditor` takes a `saveCaption` for the note shown next to Save view.
