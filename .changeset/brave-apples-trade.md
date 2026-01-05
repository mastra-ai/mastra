---
'@mastra/core': patch
---

When calling `abort()` inside a `processInputStep` processor, the TripWire was being caught by the model retry logic instead of emitting a tripwire chunk to the stream.

Before this fix, processors using `processInputStep` with abort would see errors like:

```
Error executing model gpt-4o-mini, attempt 1==== TripWire [Error]: Potentially harmful content detected
```

Now the TripWire is properly handled - it emits a tripwire chunk and signals the abort correctly,
