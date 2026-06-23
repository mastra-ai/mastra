---
"@mastra/core": patch
---

Add AIMock scenario tests for dynamic model resolution, client tools, and tool choice

Added 3 new BDD-style scenario tests (7 test cases) to the AIMock regression test suite:

- `dynamic-model.scenario.test.ts` - Tests that model resolution functions receive `requestContext` and can select different models per-request (e.g., fast vs. smart model based on context flags)
- `client-tools.scenario.test.ts` - Tests that client tools passed to `agent.stream()` merge correctly with agent-level tools, both appear in model requests, and execute successfully
- `tool-choice.scenario.test.ts` - Tests that `toolChoice` option passes through to the model request with correct values for `'none'`, `'required'`, and specific tool selection (`{ type: 'tool', toolName: 'name' }`)

All scenarios run against a real OpenAI provider pointed at an in-test AIMock HTTP server, providing regression coverage for tool resolution and model selection logic in the agentic loop.
