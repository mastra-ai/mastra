---
'@mastra/playground-ui': minor
---

Redesigned the calendar and the custom date range picker. Picking a custom range now takes one two-month calendar: click the start day, then the end day, and set each end's time underneath. Selected days are round, and the days in between read as one continuous band.

`DatePicker` now uses react-day-picker v9. If you pass react-day-picker props through it, update them to v9 names, for example `fromMonth`/`toMonth` become `startMonth`/`endMonth` and `fromDate`/`toDate` become a `disabled` rule such as `{ before: date }`.
