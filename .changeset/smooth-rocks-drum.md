---
'@mastra/core': minor
---

Added `processToolResult` processor lifecycle method that fires after each tool execution and before the result is added to message history. Symmetric with `processOutputStep`, this hook lets processors scan tool returns for prompt injection or sensitive data, transform them, or abort the run before the LLM sees the result.

```ts
class ToolResultGuard implements Processor {
  readonly id = 'tool-result-guard';
  async processToolResult({ toolName, result, abort, messageList, toolCallId, args }) {
    if (containsPromptInjection(result)) {
      abort('blocked by tool-result-guard');
    }
  }
}
```
