---
'@mastra/core': patch
---

Use `structuredOutput.instructions` for JSON prompt injection instead of always embedding the full schema

When `jsonPromptInjection` is active and no separate structuring `model` is configured, a caller-supplied `structuredOutput.instructions` string is now injected into the prompt in place of the serialized JSON schema, in both `'system'` and `'inline'` modes. On large schemas this removes thousands of tokens from every model call. Output is still validated against `schema`, and behavior is unchanged when `instructions` is absent or blank.

`instructions` is also now carried across the durable agent boundary, which previously dropped it during workflow-input serialization — so durable runs no longer silently fall back to the full schema dump.
