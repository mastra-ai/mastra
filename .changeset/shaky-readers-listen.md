---
'@mastra/langfuse': patch
---

Fixed the Langfuse exporter sending each span's input and output twice. The payload was written to the observation's input and output fields and then repeated inside its metadata, roughly doubling what Langfuse ingests and stores for workflow, agent and processor spans. Traces look the same as before: the values still appear in the observation's input and output, only the duplicate copy in the metadata is gone. Model generation and tool call spans were never affected. Fixes #23955.
