---
'@mastra/playground-ui': patch
---

Dashboard chart widgets with several views, such as Latency, Agent runs and Token usage on the Metrics page, now list them as pill tabs under the title instead of a dropdown in the title, matching the Breakdown table. Tabs sit on the left of the toolbar with the legend on the right; views that don't fit fold into a "+N" menu. Tab names drop the words views share, so "Agent latency", "Workflow latency" and "Tool latency" read "Agent", "Workflow" and "Tool". Multi-view widgets can now be renamed from their title. Widgets with an expand link keep a single title and no tabs. Custom widget kinds built on `useViewMenu` get the tabs through `heading.toolbar`.
