---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added tool replay to dataset experiments in Mastra Studio.

When running an experiment on an agent target, you can now replay tool outputs recorded by a previous live experiment instead of executing live tools: the Run Experiment dialog (and the agent playground dataset panel) gains a 'Replay tools from a previous experiment' option with a source picker and an on-miss policy (fail the item, or run the live tool).

Replay runs are visible end to end: a Replay chip on experiment lists, the replay source on the experiment page, a groundedness summary (fully grounded items, misses, unconsumed recordings, argument mismatches), a per-result Tool Replay report with a jump to the source trace, replay error codes surfaced on failed items, and an explanatory notice on replay-run traces (which contain no tool spans by design).
