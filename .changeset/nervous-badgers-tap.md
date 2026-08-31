---
'@mastra/factory': patch
---

The board's External mark now reflects what GitHub answered about an author instead of the absence of an answer. Cards that reached Done or Canceled before author trust was recorded carried no answer at all and every one of them read as an outside contribution, teammates included. The execution-consent gate is unchanged: a card without a recorded answer still asks for a person before it starts a run.
