---
'mastra': patch
---

The Factory Activity page is now one view. An **Agents** chart sits above Needs you and the timeline, so you see what every agent is doing without switching tabs.

- Each role (Triage, Planning, Building, Review) gets a lane with one bar per run, coloured by its state. Selecting a bar opens its card, and a dashed line follows a card from one role's run to the next.
- Pinch or use the zoom buttons to zoom, swipe or drag to move through time, and press **Now** to return. Older runs and commits load as you move back.
- A busy lane stays three rows tall: extra runs fold into a "+N runs" chip that lists the newest ones, and the lane's expand button shows more rows.
- Hovering a bar highlights its events in the timeline, and hovering a timeline event highlights the runs it belongs to.
- Commits on the linked GitHub repository share the time axis, with author avatars; commits too close to tell apart fold into one chip. This replaces the separate Codebase tab.
