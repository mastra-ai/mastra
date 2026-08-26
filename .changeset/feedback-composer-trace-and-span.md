---
'mastra': patch
---

Feedback in Studio's observability view is now a comment thread. The Feedback tabs of the trace panel and the span panel show existing feedback as comments with their time, and a composer underneath where you can write a comment and submit it with the arrow button. Feedback submitted from the trace panel is recorded against the trace, feedback submitted from a span is recorded against that span, and the thread refreshes as soon as the comment is saved.

To leave feedback on a run:

1. Run `mastra dev` and open **Observability** in Studio.
2. Click a trace, open its **Feedback** tab, type a comment and press the arrow button — it is saved against the trace.
3. Select a span in the trace tree, open the span's **Feedback** tab and submit there instead — the comment is saved against that span.
