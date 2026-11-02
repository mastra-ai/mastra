---
'@mastra/factory': minor
---

Each Factory project now has intake routes, an ordered list managed through the API. The first enabled route whose rule matches a new card decides the board and phase it lands on. Routes apply to each new card that arrives from GitHub, GitLab, Linear, Jira or incident.io, and to each card created without a board. A card a route placed stays on that board when its labels or source binding change later.

Routes use the same rule format as `autoStartWhen`, plus a new `author.trusted` fact. The fact is `true` for cards whose author has write access, and for cards Factory wrote itself.

```bash
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" \
  -H 'content-type: application/json' \
  -d '{ "name": "Trusted to Triage", "when": { "operator": "AND", "conditions": [{ "field": "author.trusted", "operator": "equals", "value": true }] }, "target": { "boardKey": "work", "phaseKey": "triage" } }'
```

Every project starts with a default route, `Outside authors wait in Intake`. It files GitHub and GitLab issues from authors outside the write-access circle in Work › Intake, and admins can edit, disable or delete it like any other route. Comments, edits and pushes on a card resting in Intake no longer start work; a person moves the card on.

**Behavior change:** trust now only decides where a card arrives. Factory no longer holds every run on an outside author's card for a person. Once a person has moved such a card out of Intake, a maintainer's push re-reviews it, an outside comment re-triages it, and an agent bound to it may move it, like any card. To keep a phase from auto-starting for outside authors, add `author.trusted equals true` to its `autoStartWhen`. Runs on untrusted cards still use isolated memory. Route changes are audited as `factory.intake_route.*`. See "Intake routes" in the README.
