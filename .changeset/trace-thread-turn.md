---
'@mastra/playground-ui': patch
---

A trace can now be read as the conversation it produced. The trace panel keeps two things side by side — the spans and the turn they came from — with the turn behind a "Partial thread" tab, and a button that opens the whole thread in the agent chat.

The trace's own facts moved out of a tab and into a description line under the panel heading: how long it took, when it started, and which agent, workflow or tool it belongs to. Scoring moved out of the tab list too, into a dialog opened from the header, so a trace can be scored without hunting for the right pane first.

Hovering a message in the turn highlights the span that produced it, and hovering a span highlights its message.
