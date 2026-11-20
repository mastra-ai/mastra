---
'@mastra/factory': minor
---

Added a `session` metrics group with `mastra_factory_session_first_output_ms`: how long a message sent to an idle session waits for the model's first output, whether that is text, reasoning or a tool call. Labels say whether it was the session's first run (`turn`), what the output was (`first`), and whether the run ended before the model said anything (`outcome=no_output`).

```ts
new MastraFactory({
  // ...
  metrics: { groups: ['sandbox', 'session'] }, // or 'all'
});
```

Renamed the sandbox start metrics that were named after sessions, since each one measures a sandbox start. Update any chart or alert that reads the old names, including their `_count` series:

| Old name                                     | New name                                     |
| -------------------------------------------- | -------------------------------------------- |
| `mastra_factory_session_ready_ms`            | `mastra_factory_sandbox_ready_ms`            |
| `mastra_factory_session_sandbox_wait_ms`     | `mastra_factory_sandbox_wait_ms`             |
| `mastra_factory_sessions_starting`           | `mastra_factory_sandboxes_starting`          |
| `mastra_factory_session_start_oldest_age_ms` | `mastra_factory_sandbox_start_oldest_age_ms` |
