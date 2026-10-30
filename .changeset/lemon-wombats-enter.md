---
'@mastra/playground-ui': minor
---

Added time to first token (TTFT) to the Traces, Spans and Threads lists in Studio, alongside time to first chunk (TTFC).

**Traces**: TTFT is a new optional column, sortable like TTFC. Both timings can now be used as filters, on the trace itself or on any of its spans.

**Spans**: TTFC and TTFT are new optional columns, sortable, and both can be used as filters.

**Threads**: the list now has a column picker (messages, TTFC, TTFT and more), saved per project and in saved views. Both timings can be used as filters.

**Span details**: the Timing section now shows the span's time to first chunk and time to first token when it streamed, so the root span shows the same values as the lists.

**Trace timeline**: a trace opened from the Traces list marks its first chunk with a dashed line across the timeline, and the model's time to first token as a dashed stretch ending on that line, so you can see how much of the wait came from the model and how much from earlier steps.

Each timing is only offered when the observability store records it.

`useObservabilityListFilters` now returns the sort as a field and a direction, and takes the fields a list can sort by:

```ts
// Before
const { sort, setSort } = useObservabilityListFilters(url);
setSort('asc');

// After
const { sort, setSort } = useObservabilityListFilters(url, {
  sortFields: ['startedAt', 'timeToFirstTokenMs'],
});
setSort({ field: 'timeToFirstTokenMs', direction: 'asc' });
```
