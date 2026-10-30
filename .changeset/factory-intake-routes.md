---
'@mastra/factory': minor
---

Each Factory project now has intake routes, an ordered list managed through the API. Each route decides two things for the cards that match it: where a new card lands, and whether only a person may start work on it.

A route matches cards with the same rule format as `autoStartWhen`, using a new `author.trusted` fact. The fact is `true` for cards whose author has write access, and for cards Factory wrote itself. The first enabled matching route places each new card that arrives from GitHub, GitLab, Linear, Jira or incident.io, and each card created without a board. Its `hold` (`untrusted`, `always` or `never`) also decides whether an agent may start work on the card without a person.

```bash
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" \
  -H 'content-type: application/json' \
  -d '{ "name": "Trusted to Triage", "when": { "operator": "AND", "conditions": [{ "field": "author.trusted", "operator": "equals", "value": true }] }, "target": { "boardKey": "work", "phaseKey": "triage" } }'
```

Projects without routes behave as before: cards land where their binding or label route puts them, and GitHub and GitLab cards from authors outside the write-access circle wait for a person. Only an organization admin's route with `hold: "never"` lets such cards start without a person. Route changes are audited as `factory.intake_route.*`. See "Intake routes" in the README.
