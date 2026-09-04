---
'@mastra/playground-ui': patch
'mastra': patch
---

Studio list pages (Workflows, Tools, MCP Servers, Scorers, Processors, Datasets, Experiments, Prompts) now scroll the list itself instead of the whole page, matching the Agents page: the header and filters stay fixed while the list scrolls. `DataList` no longer stretches to fill its container, so short lists and loading skeletons stay compact instead of rendering a full-height empty panel. `PageLayout height="full"` now bounds its main row to the remaining page height so nested lists can scroll internally.
