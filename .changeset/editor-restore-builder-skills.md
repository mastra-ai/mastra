---
'@mastra/editor': minor
---

Restore bundled Agent Builder skills

The Agent Builder agent (`createBuilderAgent`) now ships with 8 bundled authoring playbooks at `dist/ee/workspace/skills/`:

- `agent-prompt-quality-bar` — universal quality rules for any produced system prompt
- `coding-agent` — for agents that write, edit, review, or refactor code
- `content-writer-agent` — for agents that draft blog, marketing, or product copy
- `customer-support-agent` — for agents that triage requests and draft replies
- `generic-assistant` — fallback when no archetype clearly matches
- `ops-automation-agent` — for agents that run recurring internal tasks on a trigger
- `research-agent` — for agents that search, read, and synthesize information
- `spreadsheet-agent` — for agents that read or write tabular data

These ship as part of `@mastra/editor` and are read at runtime via the agent's `Workspace` (auto-attaches `skill`, `skill_search`, `skill_read` tools). The builder uses them to load archetype-specific authoring rules before writing the produced agent's system prompt, raising output quality without bloating the base prompt.

No public API change. Existing consumers calling `createBuilderAgent()` from `@mastra/editor/ee` automatically pick up the workspace + skills.
