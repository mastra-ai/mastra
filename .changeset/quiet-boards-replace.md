---
'@mastra/factory': patch
---

Fixed the bundled `configure-factory-rules` skill recommending ignored options. It now tells agents to replace Work by writing a board under the `work` key with `factory.upsertBoard()` instead of setting `includeDefaultBoards: false`, and to triage arrivals with an intake route and the phase's `autoStart` (optionally narrowed by `autoStartWhen`) instead of a lifecycle handler.
