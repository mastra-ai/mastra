---
'@mastra/playground-ui': minor
---

Added composable building blocks for the spans page so host apps can build their own spans filter bar, detail panel and view switch.

**Compose the spans filter bar**

`useSpansFilterBarFields` and `useSpansFilterBar` (from `@mastra/playground-ui/domains/spans/hooks`) expose the fields and value that `SpansFilterBar` uses, so you can add your own chips next to the span ones. They mirror `useTracesFilterBarFields` and `useTracesFilterBar`, but take the span filter state as arguments:

```tsx
const spanFields = useSpansFilterBarFields({ timeRange });
const { filterBarValue, onFilterBarChange, onFilterByField } = useSpansFilterBar({ tokens, groups, onFiltersChange });

<FilterBar
  fields={[projectField, ...spanFields]}
  value={{ ...filterBarValue, nodes: [...filterBarValue.nodes, ...projectItems] }}
  onValueChange={next => onFilterBarChange({ ...next, nodes: next.nodes.filter(node => !isProjectNode(node)) })}
/>;
```

The time range chip is always part of `filterBarValue` and is never passed to `onFiltersChange`. `onFilterByField(fieldId, value)` replaces any filter on that field with `is value`, for example from a list cell. Memoize `timeRange` so the fields list stays stable between renders.

**New `SpansFilterBar` props**

- `minDate` limits how far back the time range picker goes.
- `describeSuggestionsError` lets you replace the message shown when value suggestions fail to load.

**New components**

- `SpanDetailPanel` (and the `SpanSelection` type) loads a span and wires previous/next navigation, without any drawer or side panel chrome.
- `TracesSpansSwitch` and `TracesSpansSwitchSkeleton` render the Traces/Spans tabs. Pass `onViewChange` to decide what switching does instead of relying on hardcoded `/traces` and `/spans` routes.
