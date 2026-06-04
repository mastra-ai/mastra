---
"@mastra/core": minor
---

Add `ownerStream` to the return value of `Agent.sendSignal`, `Agent.sendMessage`, `Agent.queueMessage`, `Agent.sendStateSignal`, and `Agent.sendNotificationSignal`.

When the call wakes a new agent run from idle, `ownerStream` is the `Promise<MastraModelOutput<OUTPUT>>` for that run. When the signal is delivered to an already-running stream, joins a remote run, is persisted, queued, or otherwise does not start a new stream, `ownerStream` is `undefined`.

Awaiting `ownerStream` keeps the caller alive until the run completes, which is required for serverless environments (Vercel, AWS Lambda, etc.) where the handler would otherwise exit immediately after responding and kill the run mid-flight.

```ts
const result = await agent.sendMessage(message, target);
if (result.ownerStream) {
  // This call woke a new run. Await it so the run can drive any stream
  // processors (e.g. forwarding to Slack/Discord) to completion.
  await result.ownerStream;
}
```
