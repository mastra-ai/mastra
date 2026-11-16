---
'@mastra/connect': patch
---

Fixed `posthog_run_query` failing with a validation error on every query, even `select 1`. PostHog returns column types as `[columnName, clickhouseType]` pairs, such as `[["count()", "UInt64"]]`, and the tool now accepts them and returns them in that shape. Fixes [#30528](https://github.com/mastra-ai/mastra/issues/30528).
