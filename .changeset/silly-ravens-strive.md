---
'@mastra/core': minor
---

Added optional orchestration capabilities to the Agent class: event system (subscribe/on), modes (named presets of instructions/model/tools), and shared state (Zod-validated). These are the foundation for folding Harness capabilities into Agent, reducing the number of concepts users need to learn.

**Events** - Subscribe to agent lifecycle events with `subscribe()` or `on()`:

```typescript
agent.on('mode_changed', event => {
  console.log(`Switched to ${event.modeId}`);
});
```

**Modes** - Define named presets and switch between them at runtime:

```typescript
const agent = new Agent({
  modes: [
    { id: 'plan', name: 'Plan', default: true, model: 'anthropic/claude-sonnet-4-20250514' },
    { id: 'build', name: 'Build', model: 'anthropic/claude-sonnet-4-20250514', tools: buildTools },
  ],
});

agent.switchMode('build');
```

**State** - Shared, Zod-validated state that persists across mode switches:

```typescript
const agent = new Agent({
  stateSchema: z.object({ counter: z.number().default(0) }),
});

agent.setState({ counter: 1 });
console.log(agent.getState()); // { counter: 1 }
```
