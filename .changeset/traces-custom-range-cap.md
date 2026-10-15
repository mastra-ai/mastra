---
'@mastra/playground-ui': patch
---

Studio traces: the error screen shows the server's reason instead of a generic message, and auto refresh stops retrying a request the server rejected so the page no longer flickers between the list and the error. `DateTimeRangePicker` also accepts an optional `maxRangeMs` prop that blocks custom ranges longer than the given duration.
