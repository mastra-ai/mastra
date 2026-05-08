## 1. What the Harness is

The Harness is an orchestration layer that sits between an application and the Mastra agent runtime. It owns the lifecycle of conversations, the resolution of models/modes/tools/skills, and the bridge between user-facing UIs and agent execution.

Two roles, cleanly split:

- **`Harness`** — stateless infrastructure. Holds Mastra, the model resolver, the mode catalog, the skill registry, the workspace factory, and a registry of live sessions. Created once per process.
- **`Session`** — per-conversation runtime. Owns the live state of a single conversation: its thread, its mode, its current model, its display state, its pending approvals, its in-flight operations. Created on demand, disposed when the conversation closes.

A useful mental model:

> The Harness is the building. Sessions are the rooms. A room has its own occupants, lights, and state. The building has the wiring, plumbing, and front desk.

---
