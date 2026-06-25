---
'mastracode': patch
---

Trim redundant slash commands from MastraCode Web and add a per-thread action menu.

Five slash commands duplicated controls that already exist as first-class UI, so
they were removed from the composer registry and dispatch:

- `/mode` — the header already has Build/Plan tabs
- `/new` — the sidebar already has a "New thread" button
- `/rename`, `/clone`, `/delete` — now live in a per-thread `⋯` action menu

Each thread in the sidebar now has a `⋯` actions menu with **Rename** (inline
edit), **Clone**, and **Delete**, replacing the bare inline delete `×`. The menu
closes on outside click / Escape and is keyboard- and screen-reader-friendly
(`menu` / `menuitem` roles). The hook's `cloneThread` now accepts an optional
source thread id so a non-active thread can be cloned from its menu.

The remaining slash commands are either actions with no obvious button home
(goal, follow-up, abort) or quick informational lookups (cost, om, settings,
permissions, help).
