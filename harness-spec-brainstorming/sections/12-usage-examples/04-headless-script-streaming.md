### 12.4 Headless script — streaming

`message({ stream: true })` is signal-driven and always accepted. The returned `AgentStream` represents the turn that answers this signal — chunks emit as the model produces them, even if the run was already in flight when the signal landed.

```ts
const session = await harness.session({ resourceId: 'cron:report-builder' });

const stream = session.message({ content: 'Generate the weekly report', stream: true });
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

If a programmatic caller specifically wants a **clean turn boundary** (no concurrent inputs interleaved into the response), pair `sync: true` with `output: schema` (§12.3) instead — but that form does not stream.
