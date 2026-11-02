---
'@mastra/playground-ui': patch
---

Dates and times in Studio now follow the browser's locale everywhere. Chart labels, the date range picker and the date-time picker used to always show US formatting (`2 PM`, `Nov 2`) and now match the rest of Studio: a 24-hour browser sees `14:00` and `2 Nov`, and the time picker drops its AM/PM selector. Added a `playground-ui/date-locale` lint rule to `@mastra/playground-ui/oxlint` that flags dates formatted with a fixed locale or clock.
