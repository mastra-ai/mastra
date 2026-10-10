---
'@mastra/voice-aws-nova-sonic': patch
---

Transcripts that contain the word "interrupted" are no longer swallowed as a barge-in. Only Nova Sonic's JSON `{ "interrupted": true }` marker emits `interrupt`; ordinary text now emits `writing` as usual. Fixes [#26504](https://github.com/mastra-ai/mastra/issues/26504).
