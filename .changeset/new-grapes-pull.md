---
'@mastra/playground-ui': minor
---

Added operators to the Studio trace filter bar: is, is not, is any of, is none of, exists, does not exist, and `>`, `>=`, `<`, `<=` on numeric fields.

Added filter fields backed by `queryTraces` for span model, provider, span type, span name, span duration, span error, scorer, score, feedback type, feedback value and feedback comment.

Filters live in the URL so they can be shared. The operator is a sibling `.op` param and is omitted for `is`:

```
/traces?filterSpanModel=gpt-4o&filterSpanModel.op=isNot
/traces?filterSpanDurationMs=1000&filterSpanDurationMs.op=gt
/traces?filterEnvironment=prod&filterEnvironment=staging&filterEnvironment.op=in
/traces?filterSpanError=&filterSpanError.op=exists
```
