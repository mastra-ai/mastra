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

Renamed `mastra_factory_session_ready_ms` to `mastra_factory_sandbox_ready_ms`, since it times a sandbox start (the provider plus repository setup), not a session. Update any chart or alert that reads the old name, including `mastra_factory_session_ready_ms_count`.
