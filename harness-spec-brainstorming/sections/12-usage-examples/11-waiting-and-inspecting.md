### 12.11 Waiting and inspecting

```ts
if (session.isBusy()) {
  await session.waitForIdle({ timeout: 30_000 });
}

console.log({
  queueDepth: session.getQueueDepth(),
  currentRunId: session.getCurrentRunId(),
  currentTraceId: session.getCurrentTraceId(),
  tokenUsage: session.getTokenUsage(),
});
```
