---
'@mastra/connect': patch
---

Fixed the Google Analytics `run_pivot_report` tool so it accepts a property as `properties/123456789` as well as `123456789`, like `run_report` and `batch_run_reports`. Passing the prefixed form sent the request to the wrong URL and Google answered 404.
