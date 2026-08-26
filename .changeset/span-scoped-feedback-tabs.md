---
'@mastra/playground-ui': patch
'mastra': patch
---

Fixed the span Feedback tab in Studio's observability view showing the same list and count for every span of a trace: it now loads feedback strictly for the selected trace and span pair, so switching spans shows that span's own feedback. Trace-level feedback — including everything produced by the dataset review flows — now lives in a new Feedback tab on the trace panel, next to Details and Evaluations, which lists only records that aren't attached to a span. The span panel tabs also use the same pill styling as the rest of Studio instead of the deprecated underline variant.
