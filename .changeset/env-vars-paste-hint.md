---
'@mastra/playground-ui': patch
---

Add a paste hint to `EnvironmentVariablesEditor` letting users know they can paste a whole `.env` into any field. The hint renders bottom-right by default (hidden in read-only mode, opt out via `hidePasteHint`) and is also exposed as the composable `EnvironmentVariablesEditor.PasteHint` part for custom placement/copy.
