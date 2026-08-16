---
'@mastra/core': minor
---

Added `inheritMemory` to `DelegationConfig` and a one-time warning for the parent-memory graft onto memory-less sub-agents.

When a supervisor delegates to a sub-agent with no memory of its own, the parent grafts its own `Memory` instance onto the sub-agent instance itself. Since Agent instances are commonly constructed once and shared across requests, this mutates shared state for the instance's lifetime — invisibly, and with no signal that it happened.

Set `delegation: { inheritMemory: false }` to opt out; the sub-agent is left without memory instead of having the parent's grafted onto it. The graft still happens by default (`inheritMemory: true`), preserving current behavior exactly, but now emits a `logger.warn` naming both the parent and the sub-agent the first time it mutates a given sub-agent instance, so the graft is no longer silent.

This is a minimal, compatibility-preserving fix. The deeper fix — resolving the effective memory per invocation instead of mutating the shared sub-agent instance, which would remove the race between concurrent delegations to the same memory-less sub-agent — is a larger architectural change and is left to a future PR.
