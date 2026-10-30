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

<SavedViewsProvider
  source={source}
  queryKeyScope={['project', projectId]}
  // Optional: views the user may only apply (no rename, delete or save changes)
  canEdit={view => view.scope !== 'org'}
>
  <SpansPage />
</SavedViewsProvider>;
```

A searchable view picker sits at the top right of the page header, next to the Traces / Spans / Threads switch. Picking a view sets the page URL and columns exactly as setting the same filters, time range and sort by hand would; saving stores what the URL holds. Parts of an older view the page no longer supports are skipped. Traces hosts place `TracesExplorer.SavedViews` and logs hosts place `LogsSavedViews`.

Hosts whose list pages open on a range other than the last 7 days pass it as `defaultDatePreset` to `useObservabilityListFilters` and to the saved views, so that range is left out of the URL and a view of the last 7 days reopens on the last 7 days:

```tsx
const filters = useObservabilityListFilters(urlState, { defaultDatePreset: 'last-24h' });
<ObservabilitySavedViews page="spans" {...urlState} defaultDatePreset="last-24h" />;
```

Fixed filter chips that stayed on screen after the page replaced its filters (for example when switching views), and a combobox trigger icon that rendered larger than the trigger text.

`useSavedViews` now reports a failed save as `error` (was `storageError`), and `SavedViewEditor` takes a `saveCaption` for the note shown next to Save view. A saved-views controller's `rename` now returns whether the view was renamed (`boolean` or `Promise<boolean>`), so a rename form can stay open with the error when the name is taken.
