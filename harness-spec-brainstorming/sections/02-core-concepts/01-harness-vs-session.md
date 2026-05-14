### 2.1 Harness vs Session

The Harness is **restartable process-local orchestration infrastructure**. It is
the shared registry, factory, and control plane for live wiring. It may hold
process-local registries, caches, workers, intervals, listeners, and lifecycle
state, but it does not own durable per-conversation state; storage does. See §1
for the canonical responsibility split.

A Session is **per-conversation runtime**. It is the hydrated authority for one
conversation while live and persists its recoverable state through the storage
records defined in §5.

```
Harness                    Session
─────────────────────      ────────────────────────────
Process-local             Per-conversation
Shared across users        One per conversation
Owns infrastructure        Owns runtime state
Restartable               Rehydrates from storage (§5)
Created once               Created on demand
```

Code holds references to `Session` objects. The Harness is the thing that hands them out.
