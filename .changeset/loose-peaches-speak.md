---
'@mastra/evals': patch
---

Fixed AnswerRelevancyScorer (and other scorers) scoring live-agent turns 0. The scorer's user-input extractor ignored the `parts` array of format-2 messages, so when an agent persisted a message without the optional `content` string the input came through empty and every statement was judged irrelevant. The extractor now reads text from `parts` (last text part wins), matching the assistant-output extractor.
