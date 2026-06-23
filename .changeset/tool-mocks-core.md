---
'@mastra/core': minor
---

Added item-level static tool mocks so agent experiments can run deterministically without calling real, side-effecting tools.

A dataset item can now declare `toolMocks`. When the agent calls a mocked tool with matching arguments, the experiment serves the recorded `output` instead of executing the tool. Mocks for the same `(toolName, args)` are consumed in order, so repeated calls can return different outputs. If a mocked tool is called with arguments that do not match (or the mocks are exhausted), the item fails immediately and the agent is stopped so it cannot keep calling tools after a failure. Tools without a mock still run live.

```ts
await dataset.addItem({
  input: { question: 'What is the weather in Seattle?' },
  toolMocks: [
    {
      toolName: 'getWeather',
      args: { city: 'Seattle' },
      output: { temperatureF: 52 },
      // 'strict' (default) deep-compares args; 'ignore' matches on tool name only,
      // useful for sub-agent calls where the prompt is LLM-authored.
      matchArgs: 'strict',
    },
  ],
});
```

Each item result carries a `toolMockReport` describing which mocks were served, which went unconsumed, and which tools ran live, so you can see exactly how a run behaved.

Items that declare `toolMocks` run their tools sequentially (`toolCallConcurrency: 1`) within that item run to guarantee ordered consumption. Items without mocks are unaffected.
