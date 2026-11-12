---
'@mastra/factory': minor
---

**Intake routes can move cards into any phase.** A route that handles a status event (a close, a reopen, a pull request push or review request) now moves the card to its target phase even when that phase is a working phase such as Triage. One limit stays: on a board with a pull request loop, a pull request card enters only the review phase among working phases.

The move is not a person's go-ahead, so whether work starts follows the usual rules. The board decides: a phase with `autoStart` (and a matching `autoStartWhen`) starts its run, and so does a re-review of a pull request Factory opened. Otherwise the run is proposed for a person to approve. To have a reopen route into Triage re-run Triage straight away, give Triage `autoStart`.

```bash
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "Reopened bugs re-run Triage",
  "on": ["work_item.reopened"],
  "target": { "boardKey": "work", "phaseKey": "triage" }
}'
```
