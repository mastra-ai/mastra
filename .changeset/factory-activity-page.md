---
'mastra': patch
---

Opening a Factory now lands on its board, and Boards come first in the sidebar. Overview, Attention and Audit log are merged into one **Activity** page, linked at the bottom of the sidebar with a badge for unread items that need you. The Needs attention popover is gone.

- **Needs you**: failures, findings, waiting agents, mentions and proposed runs, with the discussions you follow in their own list underneath. Hovering a row swaps its kind and age for its actions: retry, run, dismiss, mark read, archive. **Mark all read** sits in the section header; archived items are one menu choice away.
- **Timeline**: what moved and who moved it, with cards that need you flagged. One properties menu groups similar events or lists every event with its details, filters by kind (work items, runs, git, agent, intake), and switches to a compact view.
- **Codebase**: the linked repository's recent commits, grouped by day.

The page lives at `/factories/:factoryId/activity`, and `?view=codebase` opens the Codebase view. Old Overview and Attention links redirect there; old Audit log links open the timeline with every event listed (`?events=all`).
