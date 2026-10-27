---
'@mastra/factory': patch
---

Added board suggestion cards and an activity band to the Factory new session page, which now asks "What should we ship, Dustin?" with your first name.

**Suggestion cards**

Under the composer, in the same tray, illustrated cards show what waits on your board: what it is, how many, and what a click does. A card appears only when something is behind it, at most six at a time, most pressing first. Its prompt names no card, so the agent looks the cards up itself, and prompts that act on cards take a batch of at most five, so one click never starts work on a whole backlog:

- **Failed runs**, _Debug and retry_: open cards whose last run failed. Finds why each failed, retries the ones it can fix, and reports what the others need.
- **Changes requested**, _Make the changes_: open Factory pull requests whose latest review asked for changes. Makes the changes, pushes them and requests a new review.
- **Longest review wait**, _Review the 5 oldest_: days the oldest pull request opened in the last month has waited in Review board Intake.
- **Not yet accepted**, _Help me decide_: cards triage classified, other than bugs, that nobody accepted yet. Suggests Accept and plan, Accept and build, or Close for each, and changes nothing until you say so.
- **Untriaged in Intake**, _Triage the 5 newest_: Work board Intake cards triage has not classified.
- **Bugs with no plan**, _Plan a fix for one_: plans a fix for the highest-impact bug nobody has planned or started.
- **Agents backlog**, _Group by root cause_: the area label with the most cards nobody has started, grouped by root cause with duplicates flagged and a plan for the biggest group. It reads the whole area, since five cards show no pattern, and changes nothing until you say so. Labels such as `p: high` and GitHub's default labels such as `enhancement` are not areas.
- **Stale pull requests**, _Flag what to close_: pull requests waiting over a month, each with a close-or-keep suggestion, and nothing closed without your go.

Pointing at or focusing a card shows its prompt in the composer at the composer's current size, so nothing moves under the pointer, and moving away brings your own draft back. Clicking starts the session with that prompt. The Factory name and branch line under the composer is gone.

**Activity band**

Below the cards, one line reads "382 came in, 282 agent runs, 292 shipped" for **This week** (the last seven days, the default), **Today** or **This month** (the last 30 days). Clicking it expands a chart of the period with one bar per hour, four hours or day; pointing at a bar opens a card with its counts. While the chart is open, the period picker sits under the band on the right. A period where nothing happened says so instead of drawing an empty chart. The band also says how many sessions are working or waiting on you, and offers **Recap the week** (or today, or the month) when something shipped.

**Audit route**

`GET /web/factory/projects/:id/audit` also takes `actions=`, a comma list of actions from the audit registry, such as `?actions=factory.run.started`. Names outside the registry are dropped, and a list naming none is a 400 `unknown_actions`, never an unfiltered page. Given with `namespaces=`, the two intersect. The activity band uses it to fetch only run starts, which halves its pages, and Today reuses the week's fetch.
