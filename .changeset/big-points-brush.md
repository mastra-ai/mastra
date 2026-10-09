---
'@mastra/playground-ui': minor
'@mastra/react': patch
---

Added a **Duration (ms)** filter to the Traces list in Studio. It filters traces by the duration of their root span, so you can show only long or short traces. The filter appears only when your observability storage supports it.

The filter is stored in the URL, so you can share a link to slow traces:

```text
/traces?filterDurationMs=2000&filterDurationMs.op=gt
```

The supported operators are `gt`, `gte`, `lt` and `lte`.
