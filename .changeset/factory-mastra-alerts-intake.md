---
'@mastra/factory': minor
---

Added Mastra Alerts as a Factory intake source. When a Platform alert fires, the Factory files a card, triages it, and opens a fix pull request for review. Nothing is merged automatically.

- **Cards.** A firing rule gets one card. Re-fires and flaps update that card, and its Alert activity panel shows the history. A card closed less than 7 days ago reopens on a re-fire; after that, a new card is filed.
- **Triage.** Binding Mastra Alerts to a project adds an Alert triage phase after Intake on that project's Work board. Alert cards start there on their own and run the bundled `alert-triage` skill. The skill reads the incident's traces and logs with short-lived, region-bound tokens, then posts the cause and the fix to the alert's Slack thread.
- **Routing.** Several projects can share an org's alerts by label, for example `platform-project:<id>` or `severity:warning`. By default only error and critical alerts become cards.
- **Integration hooks.** Integrations can implement the new `beforeWorkItemRun` and `afterWorkItemRun` hooks, and use `boardSetup` to add a phase and an intake route to a project's Work board.
