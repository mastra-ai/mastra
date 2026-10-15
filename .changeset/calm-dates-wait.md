---
'@mastra/playground-ui': minor
---

`DateTimeRangePicker` and `TraceTimeRangeChip` take a `minDate`. Days before it are disabled in both custom range calendars, and a range that already starts earlier can't be applied.

```tsx
<TraceTimeRangeChip {...rangeProps} minDate={subDays(new Date(), retentionDays)} />
```
