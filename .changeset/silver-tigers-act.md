---
'@mastra/core': patch
---

Fixed `backgroundTasks: { enabled: true }` silently dispatching foreground-only tools to the background.

Previously, enabling `backgroundTasks` on the `Mastra` instance injected a system prompt into every agent that taught the LLM to flip any tool to background by passing `_background: { enabled: true }` in its arguments, and the resolver honored that override unconditionally. Models would readily do this for short, deterministic tools — a plain calculator could return `"Background task started…"` instead of `{ result: 42 }`, breaking `agent.generate()` / `agent.stream()` for tool-using flows.

The LLM `_background` override is now treated as a *modifier* on tools the developer has opted in at the tool or agent layer, not a standalone opt-in. If a tool hasn't been opted in via tool-level `background: { enabled: true }` or agent-level `backgroundTasks: { tools: { … } }` (or `tools: 'all'`), `_background.enabled: true` from the model is ignored and the tool runs in the foreground. Opted-in tools continue to honor LLM overrides for `enabled`, `timeoutMs`, and `maxRetries` as documented.

Fixes https://github.com/mastra-ai/mastra/issues/16783
