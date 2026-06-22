---
'@mastra/core': minor
---

Added item-level static tool mocks for dataset experiments. Attach mocks to a dataset item so a side-effecting tool returns a fixed output instead of running during an experiment, making agent runs deterministic. Tools without a mock on the item still run live.

**Usage**

```typescript
await dataset.addItem({
  input: 'What is the weather in Seattle?',
  toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temperature: 60, conditions: 'rainy' } }],
});
```

Arguments are matched strictly and mocks for the same tool and arguments are consumed in order. A call with arguments that do not match (`TOOL_MOCK_MISMATCH`) or that exhausts the available mocks (`TOOL_MOCK_EXHAUSTED`) fails the item. Each item result includes a `toolMockReport` showing served, unconsumed, and live tool calls.
