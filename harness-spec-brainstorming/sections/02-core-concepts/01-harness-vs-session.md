### 2.1 Harness vs Session

The Harness is **stateless infrastructure**. It owns shared concerns — storage, mode catalog, model resolver, skill registry, workspace factory, intervals, listeners — but holds no per-conversation state itself. It's a registry and factory.

A Session is **per-conversation runtime**. It owns everything that's specific to one ongoing conversation: current mode, current model, token usage, display state, queue, pending approvals, permissions, observational-memory progress.

```
Harness                    Session
─────────────────────      ────────────────────────────
Stateless                  Stateful
Shared across users        One per conversation
Owns infrastructure        Owns runtime state
Lives for the process      Persists across restarts (§5)
Created once               Created on demand
```

Code holds references to `Session` objects. The Harness is the thing that hands them out.
