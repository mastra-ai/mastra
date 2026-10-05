---
'@mastra/playground-ui': minor
---

Added `SavedViews` to save named filters and page settings in the current browser. Users switch views from tabs, preview their filters, and save or reset edits without losing the selected tab. Failed saves keep edits available to retry.

```tsx
import { SavedViewEditor, SavedViewTabs, useSavedViews } from '@mastra/playground-ui/components/SavedViews';

const views = useSavedViews({ storageKey: 'my-page.views', settingsSchema, activeViewId, onActiveViewChange });

const setFilters = filters => (views.applied ? views.change({ filters }) : setPageFilters(filters));

<SavedViewTabs views={views} fields={fields} operators={operators} defaultLabel="All" newViewSettings={settings} />
<SavedViewEditor views={views}>
  <FilterBar fields={fields} value={views.applied?.filters ?? pageFilters} onValueChange={setFilters} />
</SavedViewEditor>
```
