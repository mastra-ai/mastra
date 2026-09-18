---
'@mastra/playground-ui': patch
---

Traces filter bar offers discovered `metadata.<key>` fields with value suggestions. The Traces and Agent Traces pages show a page-level skeleton until field discovery settles, metadata chips persist through the URL as `filterMetadata.<key>`, and they are sent to the trace query as `metadata.<key>` predicates. Stores without discovery support fall back to the existing fixed field list.
