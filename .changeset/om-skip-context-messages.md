---
'@mastra/memory': patch
---

Fixed Observational Memory saving ephemeral `context` messages to storage as durable user messages.

Messages passed through the `context` option of `agent.stream()` / `agent.generate()` belong to a single run and are not meant to be saved. Observational Memory built its observation window from the full message list, so once a buffering cycle fired it sealed and persisted those context messages too. They then came back from `listMessages` and memory recall on every later run, and showed up as user messages in any UI that hydrates from stored history.

Observational Memory now ignores `context`-sourced messages everywhere: when building the observation window, when sealing and persisting buffered chunks, and when counting tokens toward its thresholds. Context messages are still sent to the model for the run they belong to — only Observational Memory stops treating them as conversation history.

```ts
// Each turn sends per-request page state as context.
// This is no longer persisted once a buffering cycle runs.
await agent.stream(messages, {
  context: [{ role: 'user', content: '<client-context>…page state…</client-context>' }],
  memory: { thread, resource },
});
```
