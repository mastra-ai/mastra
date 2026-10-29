---
'@mastra/observability': minor
---

Added execution outcomes and stop-reason details to span lifecycle methods and both Mastra exporters. Mastra-generated stop-reason context contains compact facts and span references; custom context is copied and safely serialized before export.

Custom producers retain support for arbitrary outcome strings and context objects, including when spans are rebuilt. Framework-generated context omits raw signals, tripwire payloads, and other unbounded diagnostic data. Model chunk content remains downstream of output processors.

Custom spans can record how they ended:

```ts
span.end({ outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { maxSteps: 5 } });
```

To end a different span and its open descendants after cancellation:

```ts
runSpan.end({ endTree: true, outcome: 'abort', stopReason: 'caller_cancelled' });
```

Processed `MODEL_CHUNK` spans are now children of `MODEL_STEP`, independent of output-processor buffering. Agent-stream `MODEL_INFERENCE` spans retain provider timing and usage but no longer record response output; use processed chunks or `MODEL_GENERATION` output instead. Public native outcome fields also allow `null`, which exporter consumers must handle.

Ended spans ignore subsequent `end()`, `error()`, and outcome updates, preserving the exported result. A `null` or absent outcome means no outcome was recorded; use `endTime` to determine completion.
