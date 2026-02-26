---
'@mastra/observability': patch
---

Renamed JsonExporter to TestExporter to better reflect its purpose as an in-memory test/debug exporter. The old JsonExporter name is preserved as a deprecated alias for backward compatibility. Existing imports from './exporters/json' continue to work via re-exports.
