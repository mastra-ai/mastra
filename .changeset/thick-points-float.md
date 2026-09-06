---
'@mastra/core': patch
---

Fixed durable agent streaming being throttled by the event cache when it lives on a remote server (issue #22477). Every streamed chunk used to wait for two sequential cache round-trips before it could be published; it now waits for one, and cache backends can fuse index allocation and append into a single operation.

Added a `shouldCache` option to `createDurableAgent`, `createEventedAgent`, and the `durable` agent config so specific topics can skip the replay cache and publish straight through when resumability is not needed for them.

```ts
const durableAgent = createDurableAgent({
  agent,
  cache,
  // Stream chunks are delivered live only; other topics stay resumable.
  shouldCache: topic => !topic.startsWith('agent.stream.'),
});
```
