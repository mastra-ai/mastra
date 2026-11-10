---
'@mastra/factory': minor
---

**Intake routes can move cards into any phase.** A route that handles a status event (a close, a reopen, a pull request push or review request) now moves the card to its target phase even when that phase is a working phase such as Triage. Whether work starts there is up to the phase: one with `autoStart` (and a matching `autoStartWhen`) starts its run, any other proposes the run for a person to approve.

`allowWorkingPhase` is no longer used. Create and update requests still accept it for this release, but it is ignored, not stored, and no longer returned on routes.

```bash
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "Reopened bugs re-run Triage",
  "on": ["work_item.reopened"],
  "target": { "boardKey": "work", "phaseKey": "triage" }
}'
```
