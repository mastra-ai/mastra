---
'@mastra/playground-ui': patch
---

The traces list replaces the Start and End columns with one Time column. It shows how long ago the trace started (`3m ago`), and hovering it shows the exact start and end times. `RelativeTimestamp` takes an optional `end` to show that range in its tooltip.

Durations between 1 and 60 seconds now round to 2 significant digits (`2.8s` instead of `2.82s`) everywhere `formatDuration` is used.
