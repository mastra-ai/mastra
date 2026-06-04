# Agent Builder — Authoring Skills

This directory holds the **builder agent's own playbooks**: opinionated guides the Agent Builder reads at runtime when it needs to produce a high-quality agent of a given archetype (a coding agent, a spreadsheet agent, a research agent, etc.).

## Important: two different "skills"

The word "skills" means two things in this codebase. Don't conflate them:

1. **Builder authoring skills (this directory).** Read-only Markdown playbooks that teach the builder agent _how to write a great system prompt_ for a given archetype. Loaded via the workspace skill tools (`skill`, `skill_search`, `skill_read`) wired up automatically because `agent-builder-agent.ts` configures a `Workspace` with `skills: ['skills']`.
2. **User-attachable agent skills (the product feature).** Stored skills the end-user can attach to the agent they're building. Created via the `createSkillTool` client tool. Persisted to the editor's skill store; surfaced via `useAvailableSkills`. These are **not** what lives in this directory.

Builder authoring skills must never be attached to produced agents or mentioned to users. Produced agents can only reference user-facing capabilities that exist in the form snapshot.

## How the builder uses these files

At runtime the builder agent receives three workspace tools:

- `skill_search` — find a skill by name/description.
- `skill` — activate a skill; returns the full `SKILL.md` content as a tool result.
- `skill_read` — read a specific file inside a skill directory (references, scripts, assets).

The builder's system prompt (see `../agent-builder-agent.ts`) instructs it to:

1. Classify the user's outcome into one archetype.
2. `skill_search` for that archetype.
3. `skill` to activate it and load the playbook.
4. Synthesize a concrete run contract.
5. Use the playbook plus run contract to write the produced agent's name, description, model, capabilities, and system prompt.
6. Self-audit the final prompt before writing it.

If classification is uncertain, the builder falls back to `agent-prompt-quality-bar` (universal rules) and then `generic-assistant`.

## Run contract requirement

Every archetype skill must help the builder instantiate this contract for the produced agent:

1. **Trigger / input** — what starts a run: a user message, schedule, webhook, file, row, ticket, document, or event.
2. **Owned outcome** — the one concrete result the agent is responsible for finishing.
3. **Available capabilities** — only tools, data sources, workflows, agents, or stored skills actually attached or available.
4. **Missing-capability fallback** — what the agent does when a required integration, credential, workspace, permission, source, or input is absent.
5. **Done criteria** — how the agent proves the job is complete: tool confirmation, read-back, tests, citations, delivery receipt, or an explicit not-run reason.
6. **Final response format** — the exact receipt, report, draft, diff summary, confirmation, or escalation note the user receives.

Without a run contract, the produced prompt will sound good but fail to finish real work.

## Final audit requirement

Before the builder writes a produced system prompt, the prompt must pass this audit:

- Role/outcome is single and concrete.
- Trigger/input is named.
- Tools/capabilities are described only if attached or available.
- Missing integration/credential/workspace/source behavior is explicit.
- Completion criteria are verifiable and tool-aware.
- Final answer/receipt format is specified.
- Refusal/escalation path is present.
- No placeholders remain (`<...>`, `TBD`, `TODO`, "policy here", "your tool").
- No internal tool ids, schemas, file paths, or authoring skill names leak.
- Worked example demonstrates a complete run.

## Good completion criteria examples

Coding:

> Completion criteria: relevant files inspected; fix written; targeted test/typecheck run or explicit not-run reason; final response names changed files and behavior fixed.

Spreadsheet:

> Completion criteria: write succeeded; affected range verified by read-back or returned updated values; final receipt states sheet, tab, range, row count, and skipped rows.

Research:

> Completion criteria: current claims are searched; every finding has a citation; every numbered citation appears in the Sources list with date if available; "What I couldn't verify" is present.

Support:

> Completion criteria: ticket classified; reply drafted or action verified; every policy claim grounded; refunds verified by tool result before claimed; internal note records classification and action.

Ops automation:

> Completion criteria: idempotency key checked; action succeeded/skipped/failed/dry-run stopped; receipt includes idempotency key, affected resources, verification, status, and next run.

## Good missing-integration refusals

- Spreadsheet: "I need access to your spreadsheet first. Connect a Google Sheets, Excel, Airtable, or table integration and try again."
- Current research: "I need a search or browsing tool to research current information. Connect one and try again."
- Repo editing: "I need a connected workspace before I can inspect files, edit code, or run tests."
- Support sending: "I can draft the reply, but I can't send it until a support inbox send action is connected."
- Ops action: "I need the Slack integration before I can post to the channel."

## Internal template for every archetype skill

Every archetype `SKILL.md` follows this structure so the builder sees a consistent shape:

1. **YAML frontmatter** — `name` (must match directory name; lowercase + hyphens), `description` (1024 chars max; includes the user-facing trigger words so `skill_search` ranks it correctly).
2. **When to use** — trigger criteria.
3. **Agent identity template** — name/description patterns.
4. **Domain-specific policy** — mode selection, safety boundaries, freshness, action boundary, or missing-input rules.
5. **System prompt template** — a fully-fleshed system prompt with placeholders the builder must instantiate.
6. **Required behavioral rules** — decisiveness, output format, **completion criteria (the most important section)**, refusals.
7. **Capabilities to prefer** — which tools/skills/sub-agents to attach for this archetype.
8. **Anti-patterns** — concrete bad-prompt shapes to reject.
9. **Worked example** — a full user request → produced agent example.

## Adding a new archetype skill

1. Create a new directory under this folder named `<archetype>-agent/` (kebab-case, matches the `name` frontmatter field).
2. Add a `SKILL.md` following the internal template above.
3. Make the `description` field include the **user-facing trigger words** that would appear in a builder request. `skill_search` ranks by description; vague descriptions get skipped.
4. Define the run contract elements explicitly enough that the builder can instantiate them.
5. Include explicit **completion criteria** in the produced system prompt template. This is the single most important rule — without it, agents do not finish their work.
6. Include missing-capability fallbacks. Never let a generated agent imply access to tools, data, or integrations it may not have.
7. No code changes needed — the workspace loads `*/SKILL.md` files at agent-build time via the static `skills: ['skills']` path in `agent-builder-agent.ts`.

## Current archetypes

| Skill                      | When the builder picks it                                    |
| -------------------------- | ------------------------------------------------------------ |
| `coding-agent`             | Writes, edits, reviews, or refactors source code.            |
| `spreadsheet-agent`        | Reads or writes tabular data (Sheets, Excel, Airtable, CSV). |
| `research-agent`           | Researches a topic and produces a citation-backed report.    |
| `customer-support-agent`   | Triages or replies to inbound support messages.              |
| `content-writer-agent`     | Drafts blog posts, social, newsletters, marketing copy.      |
| `ops-automation-agent`     | Runs recurring or event-driven internal automation.          |
| `generic-assistant`        | Fallback for general-purpose personal helpers.               |
| `agent-prompt-quality-bar` | Meta-skill: universal run contract + final audit rubric.     |
