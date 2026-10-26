---
'@mastra/factory': patch
---

Added suggestions built from your board and an **In flight** line to the Factory new session page, which now asks "What should we ship, Dustin?" with your first name. Each suggestion appears only when there is something behind it, and its prompt names the cards it is about:

- **Unblock 3 failed runs**: cards whose last run failed, with the error.
- **Fix review feedback on 2 Factory pull requests**: open Factory pull requests where the current review requested changes.
- **Review 4 open pull requests**: pull requests waiting in Review board Intake, oldest first.
- **Triage 12 cards in Intake**: Work board Intake cards triage has not classified yet, newest first.
- **Plan a fix for one of 5 open bugs**: bugs not yet planned or started.
- **Recap 8 cards done this week**: cards that reached Done in the last seven days.

Pointing at a suggestion shows its prompt in the composer, and moving away brings your own draft back. Clicking it starts the session with that prompt. **In flight** counts the Work board cards in Intake, Triage, Planning, Building and Review, and links to the board. The Factory name and branch line under the composer is gone.
