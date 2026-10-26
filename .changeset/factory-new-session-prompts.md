---
'@mastra/factory': patch
---

Added suggestions built from your board and an **In flight** line to the Factory new session page, which now asks "What should we ship, Dustin?" with your first name. Each suggestion appears only when there is something behind it, at most six at a time, most pressing first. Lines that act on cards name a batch of at most five and leave the rest for another session, so one click never starts work on a whole backlog:

- **Unblock 3 failed runs**: cards whose last run failed, with the error.
- **Fix review feedback on 2 Factory pull requests**: open Factory pull requests where the current review requested changes.
- **Review 5 of 153 open pull requests**: pull requests opened in the last month and waiting in Review board Intake, oldest first.
- **Triage 5 of 317 cards in Intake**: Work board Intake cards triage has not classified yet, newest first.
- **Plan a fix for one of 49 open bugs**: picks one from every bug not yet planned or started, with the oldest five as examples.
- **Sweep 67 open Agents cards**: the area label with the most cards waiting on the Work board, grouped by root cause into one plan. Labels such as `p: high` and GitHub's default labels such as `enhancement` are not areas.
- **Close or revive 5 of 32 pull requests open over a month**: a recommendation for each, and nothing closed without your go.
- **Recap 290 cards done this week**: how many pull requests and cards reached Done since a given day, with the latest ten as examples.

Pointing at a suggestion shows its prompt in the composer at the composer's current size, so nothing on the page moves under the pointer, and moving away brings your own draft back. Clicking it starts the session with that prompt. **In flight** counts the Work board cards in Intake, Triage, Planning, Building and Review, and links to the board. The Factory name and branch line under the composer is gone.
