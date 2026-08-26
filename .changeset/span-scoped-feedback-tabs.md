---
'@mastra/playground-ui': patch
'mastra': patch
---

Fixed the span Feedback tab in Studio's observability view showing the same list and count for every span of a trace: it now loads feedback strictly for the selected trace and span pair, so switching spans shows that span's own feedback. Trace-level feedback — including everything produced by the dataset review flows — now lives in a new Feedback tab on the trace panel, next to Details and Evaluations, which lists only records that aren't attached to a span. The span panel tabs also use the same pill styling as the rest of Studio instead of the deprecated underline variant.

To see each kind of feedback:

1. Run `mastra dev` and open **Observability** in Studio.
2. Open a trace and select its **Feedback** tab — it lists trace-level feedback only, such as records left by dataset review.
3. Select a span in the trace tree and open the span's **Feedback** tab — it lists only that span's feedback, and the list changes as you select other spans.
