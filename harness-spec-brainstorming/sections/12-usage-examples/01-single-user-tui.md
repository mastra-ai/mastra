### 12.1 Single-user TUI

The classic Mastra Code shape. One human, one process, one conversation at a time, but the user can switch between threads.

```ts
import { Harness } from '@mastra/core/harness/v1';
import { config } from './harness-config';

const harness = new Harness(config);
await harness.init();

// Bootstrap: resolve a session for this resource.
// Picks up the most-recent thread+session, or creates fresh ones if none exist.
const session = await harness.session({ resourceId: 'local-user' });

// Subscribe to events for live rendering.
const unsubscribe = session.subscribe((event) => {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'tool_start':
      console.log(`\n[tool] ${event.toolName} started`);
      break;
    case 'agent_end':
      console.log('\n[idle]');
      break;
  }
});

// User types something. `message` is always accepted — drains into the live
// run via signals if the agent is busy, or starts a new run if idle.
session.message({ content: 'Refactor the auth middleware' });

// User types again while the agent is still working. With agent signals this
// just drops into the same run as new user input — the model sees both
// messages mid-reasoning.
session.message({ content: 'Also add rate limiting' });

// Use `queue` instead when you specifically want sequential, isolated turns
// (one turn finishes fully before the next prompt starts).
session.queue({ content: 'Now run the test suite' });

// User switches to a different thread. The current session stays resumable in storage —
// we don't close it, we just stop using it. (Eviction will drop it from memory if idle.)
const otherSession = await harness.session({ sessionId: otherSessionId });

// Shutdown.
await harness.shutdown();
```
