---
'@mastra/core': minor
---

Workflow run event topics are now cleaned up automatically. The evented workflow engine deletes each run's `workflow.events.v2.<runId>` pub/sub topic shortly after the run reaches a terminal state (success, failure, or cancellation), so persistent transports like Redis Streams no longer accumulate streams from finished workflow runs (#19123).

`clearTopic` is now part of the `PubSub` base class with a default no-op implementation. Custom transports that retain messages per topic should override it to delete that state:

```typescript
import { PubSub } from '@mastra/core/events';

class CustomPubSub extends PubSub {
  async clearTopic(topic: string): Promise<void> {
    // delete retained state for the topic
  }
}
```

Callers no longer need to probe for the method before calling it — `CachingPubSub` and the durable-agent runtime now forward `clearTopic` unconditionally.
