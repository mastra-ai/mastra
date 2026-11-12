---
'@mastra/factory': minor
---

Added routes that run when a card leaves a phase. Intake routes only ran when a card arrived, so a phase that sets a card's labels, such as a custom Triage phase, could not have those labels decide where the card goes next. A route on `phase.exited` names the phase it listens on in `from`; when a card leaves that phase, the first matching route sends it to its target, which can be on another board. With no match the card goes where its mover sent it.

```json
{
  "name": "Docs work",
  "on": ["phase.exited"],
  "from": { "boardKey": "shipyard", "phaseKey": "triage" },
  "when": { "operator": "AND", "conditions": [{ "field": "item.labels", "operator": "contains", "value": "area: docs" }] },
  "target": { "boardKey": "docs", "phaseKey": "writing" }
}
```

Before the routes run, Factory syncs that one card from GitHub, GitLab, Linear, Jira or incident.io, so labels the phase just set count even before their webhook arrives. A route's move never sets off another route, the mover's own move is still checked against the board and the phase's exit tool, and the card's history and audit log name the route that moved it.
