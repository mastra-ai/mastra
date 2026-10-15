---
'@mastra/playground-ui': minor
---

Added a `minDate` prop to `DateTimeRangePicker` and `TraceTimeRangeChip`, so you can stop users picking dates with no data, such as traces past retention. Days before `minDate` are disabled in both custom range calendars, and a range that already starts earlier can't be applied.

```tsx
<TraceTimeRangeChip {...rangeProps} minDate={subDays(new Date(), retentionDays)} />
```
