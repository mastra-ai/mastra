---
'@mastra/core': minor
---

BREAKING: On a plain `Agent`, `durable` now controls resumable streams only, not checkpoint-backed execution. Omit it for streams on registered agents and off standalone agents; use `true` to enable streams everywhere, `false` to disable them, or an object containing `pubsub`, `cache`, `shouldCache`, and `cleanupTimeoutMs`.

Remove implicit durable execution wrapping, both on Mastra registration and standalone calls. `maxSteps`, `shouldPersistSnapshot`, `id`, and `name` are no longer plain-agent durable options; pass execution options to `createDurableAgent` instead. JavaScript callers and persisted agents carrying those keys receive a migration warning. Export `AgentStreamsConfig` alongside `AgentDurableOption` so callers can name the stream configuration object type.

The published `@mastra/core@1.82.0` API already uses `durable` and exports neither `AgentStreamsConfig` nor `AgentStreamsOption`. The `streams` to `durable` rename applies only to unreleased development builds; the released breaking change is the meaning of `durable`.

Before:

```ts
const agent = new Agent({ ...config, durable: { maxSteps: 50 } });
```

After, for durable execution:

```ts
import { createDurableAgent } from '@mastra/core/agent/durable';

const agent = createDurableAgent({
  agent: new Agent(config),
  maxSteps: 50,
  cache: false,
});
```

For resumable streams without checkpoint execution:

```ts
const agent = new Agent({ ...config, durable: { cache: false } });
```

Existing stored agents with `durable: true` or a durable options object now load as plain agents with resumable streams. They no longer write checkpoints or recover execution, and an existing stored `maxSteps` value no longer configures execution. Migrate agents that need durable execution to an explicit code-defined `createDurableAgent({ agent })` wrapper. With `durable: false`, HTTP disconnects abort plain-agent runs; explicit durable wrappers continue running.
