---
'@mastra/core': patch
---

Add `runOptions` to `AgentControllerConfig`, so a host can set the loop controls on controller-driven runs.

`AgentController` builds its own `agent.stream()` options and previously exposed no way to extend them, pinning every run to `maxSteps: 1000` and dropping `stopWhen`, `prepareStep`, `providerOptions`, `modelSettings`, `toolCallConcurrency`, and the step callbacks. Agents that depend on per-call loop control could not be driven through a session.

`runOptions` accepts a static object or a per-request factory, and applies to the initial stream and every resume. Options carrying run identity — `memory`, `abortSignal`, `requestContext`, `toolsets`, `activeTools`, `instructions`, `outputWriter`, `requireToolApproval` — stay controller-owned and cannot be overridden. Host `providerOptions` are now merged with, rather than replaced by, the Anthropic server-side fallback.
