---
'@mastra/playground-ui': minor
---

Redesigned the calendar and the custom date range picker. Picking a custom range now takes one two-month calendar: click the start day, then the end day, and set each end's time underneath. `DateTimePicker` uses the same time field instead of hour, minute and AM/PM dropdowns. Selected days are round, and the days in between read as one continuous band.

`DatePicker` now uses react-day-picker v9. If you pass react-day-picker props through it, rename them to their v9 equivalents:

- `fromMonth` / `toMonth` → `startMonth` / `endMonth`
- `fromDate={date}` → `startMonth={date}` plus `disabled={{ before: date }}` (or `hidden={{ before: date }}` to hide those days)
- `toDate={date}` → `endMonth={date}` plus `disabled={{ after: date }}` (or `hidden={{ after: date }}`)

```tsx
// Before
<DatePicker mode="single" selected={day} onSelect={setDay} fromDate={minDay} />

// After
<DatePicker mode="single" selected={day} onSelect={setDay} startMonth={minDay} disabled={{ before: minDay }} />
```

`TimePicker` is removed. Use `<Input type="time" />`, which reads and writes `HH:mm`.
