---
'@mastra/playground-ui': patch
---

Trace and thread loading skeletons now match the loaded layout, so the panels no longer shift when data arrives. The span tree placeholder no longer shows a second search field, its rows have the same height as the real span rows, and the thread placeholder lines up its tabs, messages column and span tree with the loaded thread.

The Messages, Feedback and Scores tabs in the trace panel now appear only once the spans have loaded, so the first tab no longer switches from Feedback to Messages. Rows in the full thread view are no longer dimmed when they are out of view or hovered.
