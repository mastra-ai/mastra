---
'@mastra/connect': patch
---

Fixed `posthog_run_query` failing provider-response validation whenever PostHog returned column types, which it does for every query with columns, even `select 1`. PostHog returns column types as `[columnName, clickhouseType]` pairs, such as `[["count()", "UInt64"]]`, and the tool now accepts them and returns them in that shape. The inferred type of `types` in the tool's output changes from `string[]` to `[string, string][]`, and a plain string entry, which PostHog never sends, is now rejected. Fixes [#30528](https://github.com/mastra-ai/mastra/issues/30528).
