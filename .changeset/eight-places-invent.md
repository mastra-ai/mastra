---
'@mastra/playground-ui': minor
---

Polished the shared sidebar so it looks the same in every app.

- The sidebar is 232px wide by default (192px to 340px when dragged) and 60px collapsed. The defaults live in the component and `SIDEBAR_WIDTHS` exports them; pass `minWidth` only when a view needs more room.
- Rows sit 1px apart and 10px from the sidebar's edges, with 8px under the header. Groups sit 14px apart, with titles 4px above their rows, and the first group's title is kept for screen readers only.
- Filled product icons (Agent, Workflow, MCP Server) draw at the same size as the line icons beside them.
- The logo glides into place when the sidebar collapses or expands instead of jumping. The resize handle and the collapsed logo's toggle appear after a short hover delay, so passing over them doesn't flash them.
- The nav's scrollbar no longer stays on screen after you click a link, and expanding the sidebar onto an open sub-menu no longer moves focus to its Back button.

`Sidebar.Meter` keeps one layout in both states and folds into the rail. It accepts `loading`, which shows the card at its loaded size, and `railValue`, a shorter amount for the rail:

```tsx
<Sidebar.Meter label="Credits" value="$6,649.10" railValue="$7k" status="Auto top-up On" />
<Sidebar.Meter loading label="Credits" value="" status=" " />
```
