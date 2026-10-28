---
'@mastra/observability': minor
---

Added native outcome, stop reason, and typed context to span lifecycle, export, and snapshot handling. Completed spans keep their outcomes during tree cleanup; provider inferences keep their own result when downstream processors retry or reject output.

```ts
span.endTree({ outcome: 'abort', stopReason: 'caller_cancelled' });
```

Native values remain separate from computed status. Missing producer values do not imply success or ongoing execution. Platform ingestion and storage integration remain separate work.
