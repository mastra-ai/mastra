---
'@internal/agent-sdk-base': minor
'@mastra/claude': patch
'@mastra/cursor': patch
'@mastra/openai': patch
---

Moved shared SDK-agent helper code (used internally by the Claude, Cursor, and OpenAI SDK agent wrappers) into a new internal package. No behavior change for Claude or OpenAI. For Cursor, `structuredOutput` is no longer accepted on run options at the type level — this always failed at runtime (the Cursor SDK has no schema-constrained output API), so this just catches it earlier, at compile time instead.
