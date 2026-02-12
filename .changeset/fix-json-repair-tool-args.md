---
'@mastra/core': patch
---

Fix tool calls with malformed JSON arguments from certain LLM providers (e.g., Kimi/K2) silently failing. (#11078)

**Auto-repair** — four common malformation patterns are now fixed before parsing:

- Missing opening quote on property names: `{"a":"b",c":"d"}` → `{"a":"b","c":"d"}`
- Fully unquoted property names: `{command:"ls"}` → `{"command":"ls"}`
- Single quotes instead of double quotes: `{'key':'val'}` → `{"key":"val"}`
- Trailing commas: `{"a":1,}` → `{"a":1}`

**Model retry** — unrepairable JSON now returns a `parseError` through the error pipeline so the model can self-correct.

**`repairToolCall` hook** — new option on agent execution for custom repair logic when auto-repair isn't enough or the tool name is unknown.
