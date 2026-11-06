# 0007: One filter bar holds every scope

**Decision**: a page filtered by more than free text has one `FilterBar`, and its time range is the bar's first chip. No other control filters the page.

**Scope**: index pages and dashboards: lists, traces, logs, metrics, requests. A page whose only control is a time range uses `DateTimeRangePicker` alone. A list filtered only by free text keeps `ListSearch`.

**Why**: when the range sits in one control and the filters in another, the reader has to look in two places to know what the numbers cover, and each control drifts in size and behavior on its own. One bar puts every scope in one row, with one keyboard order and one reset.

**Evidence**: `FilterBarTimeRange` in `src/ds/components/FilterBar/filter-bar-time-range.tsx` exists to put the range inside the bar: "A filter bar's time range: the `DateTimeRangePicker` itself at the bar's rung, so it looks and behaves exactly as it does anywhere else." Studio's Metrics page uses it (`MetricsTimeRangeChip`, "the same control the Traces page shows"), as do the Datasets, Experiments, and review queue filter bars. Requested on review of the requests dashboard example, 2026-11-06: "what about the actual filterbar".

**Rejected**: a `SegmentedControl` range beside the bar, which the first draft of the dashboard examples used.

**Approved by**: pending. Proposed after review by Justin Levine (`@jal-co`), 2026-11-06.

**Reaches**: `rg -n "SegmentedControl|DateTimeRangePicker" packages mastracode --glob '*.tsx'` on pages that also render `FilterBar`
