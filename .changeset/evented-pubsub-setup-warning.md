---
'@mastra/core': minor
---

Added a warning for evented workflows and evented agents that run on a setup that can't support several processes.

Running evented execution on more than one process needs a pubsub that redelivers unacknowledged events and a workflows store with step guards. Mastra now logs a warning the first time an evented run is created when:

- the pubsub delivers to other processes but doesn't redeliver a stopped worker's events, as with `UnixSocketPubSub`
- the pubsub redelivers events and the workflows store has no step guards

The default `EventEmitterPubSub` doesn't warn. It delivers inside one process, which is how evented workflows and agents run locally and in tests. Set `MASTRA_DISABLE_EVENTED_SETUP_WARNING=true` to disable the warning.

**New `PubSub.deliversAcrossProcesses` property**

It defaults to `true`. If you see the warning with a custom pubsub, declare what its transport does:

```ts
import { PubSub } from '@mastra/core/events';

class MyBrokerPubSub extends PubSub {
  // The broker gives an unacknowledged event to another consumer of the group.
  override get redeliversUnacked() {
    return true;
  }

  // publish(), subscribe(), unsubscribe(), flush()
}

class MyInProcessPubSub extends PubSub {
  // Every subscriber lives in the publishing process.
  override get deliversAcrossProcesses() {
    return false;
  }

  // publish(), subscribe(), unsubscribe(), flush()
}
```

See [evented workflows and agents](https://mastra.ai/docs/server/pubsub#evented-workflows-and-agents) for the supported pubsubs and storage adapters.
