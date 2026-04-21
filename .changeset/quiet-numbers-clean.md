---
'@mastra/playground-ui': patch
---

Added a new PropertyFilter component suite for building Linear-style URL-driven filter UIs. Four composable primitives that share a single `PropertyFilterField` / `PropertyFilterToken` contract:

- **`PropertyFilterCreator`** — the "+ Add Filter" popover. Lists available fields (optionally grouped), walks the user through property → value → commit. Text fields hand off focus to an inline pill input; pick-multi fields open a side panel with radio (single-select) or checkbox (multi-select) options, optional search, and per-field loading state.
- **`PropertyFilterApplied`** — the pill row rendering active filter tokens. Text pills carry an always-active `Input` that applies on every keystroke and survives URL round-trips (including empty pending values). Pick-multi pills reuse the same side panel as the Creator so edit and create share one UI.
- **`PropertyFilterActions`** — the overflow action bar: Clear (neutralize pill values), Remove all filters, Save current filters, Remove saved filters.
- **`PickMultiPanel`** — shared body for the side popover, reused by both Creator and Applied.

Added a `size` prop to `DateTimeRangePicker` that is forwarded to both trigger buttons (preset dropdown and custom-range popover) so it can match the rest of the toolbar on smaller surfaces.

```tsx
import {
  PropertyFilterCreator,
  PropertyFilterApplied,
  PropertyFilterActions,
  DateTimeRangePicker,
  type PropertyFilterField,
  type PropertyFilterToken,
} from '@mastra/playground-ui';

const fields: PropertyFilterField[] = [
  { id: 'status', label: 'Status', kind: 'pick-multi', options: [...] },
  { id: 'tags', label: 'Tags', kind: 'pick-multi', multi: true, options: tags, isLoading: isTagsLoading },
  { id: 'traceId', label: 'Trace ID', kind: 'text' },
];

<DateTimeRangePicker size="sm" preset={preset} onPresetChange={setPreset} />
<PropertyFilterCreator fields={fields} tokens={tokens} onTokensChange={setTokens} />
<PropertyFilterApplied fields={fields} tokens={tokens} onTokensChange={setTokens} />
<PropertyFilterActions onClear={neutralizeValues} onRemoveAll={removeAllPills} onSave={persist} />
```
