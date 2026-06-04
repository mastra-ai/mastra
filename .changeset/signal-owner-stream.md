---
"@mastra/core": minor
---

Add `ownerStream` to the return value of `Agent.sendSignal`, `Agent.sendMessage`, `Agent.queueMessage`, `Agent.sendStateSignal`, and `Agent.sendNotificationSignal`.

When the call wakes a new agent run from idle, `ownerStream` is the `Promise<MastraModelOutput<OUTPUT>>` for that run. When the signal is delivered to an already-running stream, joins a remote run, is persisted, queued, or otherwise does not start a new stream, `ownerStream` is `undefined`.

`MastraModelOutput` is lazy — awaiting the promise itself only resolves to the wrapper. To drive the run to completion, await `consumeStream()` (or any of the delayed-promise getters like `.finishReason`, `.text`, etc., which kick off consumption automatically). This is required for serverless environments (Vercel, AWS Lambda, etc.) where the handler would otherwise exit immediately after responding and kill the run mid-flight.

```ts
const result = await agent.sendMessage(message, target);
if (result.ownerStream) {
  // This call woke a new run. Drive it to completion so any stream
  // processors (e.g. forwarding to Slack/Discord) can finish.
  const ownerStream = await result.ownerStream;
  await ownerStream.consumeStream();
}
```

`consumeStream()` is idempotent and safe to call even if another consumer is already draining the stream.
