---
'@mastra/factory': patch
---

Added board suggestion cards and an activity band to the Factory new session page, which now asks "What should we ship, Dustin?" with your first name.

**Suggestion cards**

Under the composer, in the same tray, illustrated cards show what waits on your board: what it is, how many, and what a click does. A card appears only when something is behind it, at most six at a time, most pressing first. Its prompt names no card, so the agent looks the cards up itself, and prompts that act on cards take a batch of at most five, so one click never starts work on a whole backlog:

- **Failed runs**: open cards whose last run failed. Finds why, retries the fixable ones, reports the rest.
- **Changes requested**: open Factory pull requests whose current review requested changes.
- **Longest review wait**: days the oldest pull request opened in the last month has waited in Review board Intake. Reviews the five oldest.
- **Needs your decision**: cards triage classified, other than bugs, that nobody accepted yet. Recommends accepting, merging or closing each, and changes nothing until you say so.
- **Untriaged in Intake**: Work board Intake cards triage has not classified. Triages the five newest.
- **Bugs with no plan**: plans a fix for the highest-impact bug nobody has planned or started.
- **Waiting in Agents**: the area label with the most open cards, grouped by root cause into one plan. Labels such as `p: high` and GitHub's default labels such as `enhancement` are not areas.
- **Stale pull requests**: pull requests waiting over a month, each with a close or revive recommendation, and nothing closed without your go.

Pointing at or focusing a card shows its prompt in the composer at the composer's current size, so nothing moves under the pointer, and moving away brings your own draft back. Clicking starts the session with that prompt. The Factory name and branch line under the composer is gone.

**Activity band**

Below the cards, one line totals what shipped, how many agent runs started and what came in, for **Today**, **This week** (the last seven days, the default) or **This month** (the last 30 days), picked from its title. Clicking the totals expands a chart of the period; pointing at a column opens a card with that hour, four hours or day's counts. The band also says how many sessions are working or waiting on you, offers **Recap the week** (or today, or the month) when something shipped, and links to all work on the board.
