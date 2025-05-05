---
'create-mastra': patch
'@mastra/playground-ui': patch
'mastra': patch
---

lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
