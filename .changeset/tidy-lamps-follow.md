---
'@internal/playground': minor
---

Reworked the Studio Trace Intelligence page around landmark snapshots — a bounded, time-balanced selection of snapshots instead of every snapshot in range.

**Timeline** — snapshots appear as ticks on a time axis positioned by when they became current, with day labels, snap-to-tick scrubbing, and playback that stops at the end. Only the selected snapshot's flow is fetched, so the page loads without waiting on dozens of requests.

**Three views** — a pill-tab switcher offers Flow (the Sankey diagram, now showing the set of traces classified by every signal so all columns add up), Compare (pick two points in time and see which themes grew, shrank, appeared, or disappeared per signal, with sparklines), and Lifelines (every theme as a row showing its presence across all snapshots, collapsible per signal).

**Drill-down** — clicking a theme in the Flow view shows an explicit filter banner with a dismissible chip and a trace subset summary; noise buckets, compare cards, and lifeline points all open the theme details drawer. Trace observations in the details drawer now render severity and kind as tinted cards and badges instead of raw prefix text.

The agent selector moved into the breadcrumb (deep-linkable via `?agent=`), and the date filter sits inline with the view tabs.
