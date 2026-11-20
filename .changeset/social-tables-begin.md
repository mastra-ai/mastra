---
'@mastra/mcp-apps-components': patch
---

Fixed observability dashboard widgets showing "Couldn't load" in Codex. The widget sent its date window as `Date` objects inside `queryObservability` arguments, which Codex rejects as invalid tool-call params. The dates are now sent as ISO strings.
