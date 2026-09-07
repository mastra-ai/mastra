---
'@mastra/playground-ui': patch
---

Changed the `TracesLayout` side panel to render as an absolute, full-height overlay (`absolute inset-y-0 right-0`) instead of an in-flow grid column. In Studio, the trace side panel on `/traces` and on entity traces tabs now spans the whole app frame height, covering the route header and page toolbar, while the trace list keeps its left column. Consumers must render `TracesLayout` inside a positioned (`relative`) ancestor sized to the area the panel should cover.
