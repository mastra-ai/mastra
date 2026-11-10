---
'@mastra/factory': patch
---

Fixed three problems found running a stored board without approval gates:

- **Triage can skip the approval wait.** When a board's triage phase says in its `runner.instructions` that the board needs no approval before work starts, factory-triage sends trusted, in-scope features, docs and maintenance items straight to the plan phase instead of resting them for a person. The default Work board is unchanged.

  ```json
  {
    "key": "triage",
    "runner": { "skill": "factory-triage", "instructions": "This board needs no approval before work starts." }
  }
  ```

- **Triage labels work on new repositories.** factory-triage and factory-build create every label they add (`status: *`, `effort:*`, `impact:*`, `severity:*`) when it is missing, and add each label in its own call, so one missing label no longer drops the rest.
- **No catalog problem for an untouched Review row.** A stored `review` board that Factory seeded and nobody edited is no longer reported as `Stored board "review" isn't served`. A row a person edited is still reported.
