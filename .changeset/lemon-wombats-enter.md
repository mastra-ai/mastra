---
'@mastra/playground-ui': minor
---

Added time to first token (TTFT) to the Traces, Spans and Threads lists in Studio, alongside time to first chunk (TTFC).

**Traces**: TTFT is a new optional column, sortable like TTFC. Both timings can now be used as filters, on the trace itself or on any of its spans.

**Spans**: TTFC and TTFT are new optional columns, sortable, and both can be used as filters.

**Threads**: the list now has a column picker (messages, TTFC, TTFT and more), saved per project and in saved views. Both timings can be used as filters.

**Span details**: the Timing section now shows the span's time to first chunk and time to first token when it streamed, so the root span shows the same values as the lists.

**Trace timeline**: a trace opened from the Traces list shows its time to first chunk and time to first token as two dashed rows above the spans, both ending on the first chunk and set apart from the spans by a separator. You can see at a glance how much of the wait came from the model and how much from earlier steps.
