---
'@mastra/core': patch
---

Introduce the `SessionMachinery` injection boundary on the Harness Session. This formalizes the narrow set of Harness-owned capabilities (resolve the current agent, build run/stream options + toolsets + request context, persist token usage, generate ids, open a thread subscription) that a Session leverages to drive an agent run. The Harness injects this machinery into each Session it constructs via `session.setMachinery(...)`.

This is the dependency-injection foundation for making the run loop, run state, and thread stream session-owned (so one Harness can serve many concurrent sessions). No behavior change in this step — the machinery is wired but not yet consumed.
