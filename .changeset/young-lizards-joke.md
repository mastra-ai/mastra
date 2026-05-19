---
'@mastra/observability': minor
---

`MastraStorageExporter` now notifies custom exporters and connected integrations when it cannot persist observability events, such as unsupported storage or retries being exceeded. This matches the behavior already available on `DefaultExporter`.

Also fixed an issue in both exporters where span updates waiting on their parent span could be silently lost if a later flush in the same cycle failed.
