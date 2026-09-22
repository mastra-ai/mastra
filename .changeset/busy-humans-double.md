---
'@mastra/playground-ui': patch
---

Simplified the reasoning toggle in the chat view. It now reads "Reasoning" in muted text next to a chevron, instead of a badge whose label flipped between "Show reasoning" and "Hide reasoning". The chevron and `aria-expanded` carry the open state, so the label stays still while you open and close it.

The panel is now the shared Collapsible used by tool calls and chat events, so opening and closing it animates its height instead of snapping.
