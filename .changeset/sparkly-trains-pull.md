---
'@mastra/playground-ui': patch
---

Added Model and Provider filters to the Spans page. When the observability store records span models, you can filter spans by the model or provider that served them, with value suggestions drawn from recorded spans. Stores that don't support these filters don't offer them.

The span details panel now shows the model and provider for any span that recorded them, such as agent runs, not only model calls.
