---
'@mastra/observability': minor
---

Fixed broken traces when `spanFilter` drops a span.

- Children of a dropped span now attach to the nearest exported parent. Before, exporters such as Langfuse showed them detached from the trace.
- A span whose end is dropped after its start was exported is now closed at its end time. Before, it stayed open in Mastra storage, and exporters such as Braintrust and LangSmith reported it as failed at shutdown.

See [#29693](https://github.com/mastra-ai/mastra/issues/29693).
