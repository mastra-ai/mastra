# Product Vision — Mastra Software Factory

## What it is

Mastra Software Factory (`@mastra/factory`) is the reusable backend that turns a Mastra deployment into an agent-powered software delivery pipeline. It is the server core behind the Factory product: storage domains, HTTP routes, rules, third-party integrations, sandboxes, and Factory-specific agent behavior all live in this one package. Frontend concerns live in `factory-ui`, host wiring lives in `web`, and shared agent-controller behavior lives in `sdk` — this package is the backend contract all three build on.

## Why it exists

Software teams already track work in GitHub Issues/PRs and Linear, and they already have an AI coding agent (Mastra Code) that can triage, plan, implement, and review changes. The gap Factory closes is orchestration: something has to decide *when* an agent should act on a card, *which* seat (triage/plan/build/review) it acts in, *what* guardrails apply before a human has signed off, and *how* the outcome flows back to the card and the source system. Factory is that orchestration layer — a Kanban-style board whose columns are agent seats, driven by rules that react to intake events, tool results, and human transitions.

## Core outcomes it must deliver

- **Low-friction intake.** Issues and PRs (GitHub), issues (Linear), and manually created cards all materialize as work items without a person re-typing anything.
- **Guarded autonomy.** An agent may not silently take over a card a human hasn't looked at. Non-bug items and externally-authored items require an explicit human transition or acceptance before agents run unattended; a project can flip on `autoRunEnabled` / `autoApprovePlans` to relax this deliberately.
- **Traceable decisions.** Every transition, rule evaluation, and rejection is committed with a causal chain and an operator-maintained `configVersion` label, so any row can be traced back to the code that produced it.
- **Board-owned lifecycle.** Work and Review are the built-in boards; any deployment can define its own board (`defineBoard`) with its own phases, transition policy, and tool-result rules — there is no global rules object, every rule has exactly one owner.
- **One storage boundary.** A single `FactoryStorage` backend (Postgres or LibSQL) backs both the agent runtime (threads/messages/memory) and the Factory application tables (projects, work items, audit, intake, documents), so a deployment configures one connection and gets every feature.
- **Essential project documentation, kept current.** A fixed catalog of 14 business/technical documents (`docs/factory/*.md`) is synced from the repository on session materialization so agents kick off with the same context a human reviewer would have.

## Non-goals (v1)

- Per-factory configuration of the document catalog (kinds and default paths are hardcoded; only the mapped paths are configurable via `manifest.yaml`).
- Built-in override/replacement of Work's or Review's lifecycle handlers from host configuration — customization happens by defining new boards, not by patching the built-ins.
- A generic workflow engine — boards are intentionally board/phase/role shaped for software delivery, not an arbitrary state-machine product.
