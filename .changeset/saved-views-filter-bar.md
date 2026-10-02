---
'@mastra/playground-ui': minor
---

Added `SavedViews`, Linear-style saved views for pages that use `FilterBar`. A new view starts with no filters, or with the filters passed to `views.create(settings, filters)` to save filters already in use. Users keep or change page settings such as sort and layout, and save the view under a name. Views then switch from tabs. Hovering another view's tab previews its filters; clicking the active tab, or right-clicking any tab, edits, renames, duplicates or deletes it. A view with unsaved changes keeps its tab and offers Save changes or Reset. New views show that they are saved in the current browser. Views are stored in localStorage and checked against a schema on every read, so a malformed view is dropped instead of breaking the page. Failed writes show an error and keep edits available to retry.

Fixed `FilterBar` chips rendering `[object Object]` as the value of their hidden form inputs, which showed up when a chip's text was copied.

`FilterBar` chips with several values now show the first value and a count, such as `prod +2`, instead of a truncated list. Hovering the value, or reading it with a screen reader, still gives every value.

```tsx
import { SavedViewEditor, SavedViewTabs, useSavedViews } from '@mastra/playground-ui/components/SavedViews';

const views = useSavedViews({ storageKey: 'my-page.views', settingsSchema, activeViewId, onActiveViewChange });

const setFilters = filters => (views.applied ? views.change({ filters }) : setPageFilters(filters));

<SavedViewTabs views={views} fields={fields} operators={operators} defaultLabel="All" newViewSettings={settings} />
<SavedViewEditor views={views}>
  <FilterBar fields={fields} value={views.applied?.filters ?? pageFilters} onValueChange={setFilters} />
</SavedViewEditor>
```
