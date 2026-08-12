---
'@mastra/observability': minor
---

Added an `indexed` redaction style to `SensitiveDataFilter`. Instead of collapsing every sensitive value to the same `[REDACTED]` string, each unique value gets a stable token derived from the first matched field name, like `[APIKEY_1]`. The same value maps to the same token across the spans of a trace while the trace's mapping is retained, so redacted traces keep their referential structure (you can tell whether two redacted fields held the same secret or different ones) without exposing the raw values. Token numbering restarts for each trace, so values cannot be linked across traces. Mapping state is bounded: the filter keeps state for the 1000 most recently used traces (spans of an evicted trace start a fresh mapping) and tracks up to 1000 unique values per trace (new values beyond the cap fall back to the full redaction token).

```ts
new SensitiveDataFilter({
  redactionStyle: 'indexed',
});
```

See [#21313](https://github.com/mastra-ai/mastra/issues/21313)
