---
'@mastra/factory': patch
---

The reconcile sweep now records author trust for cards it had stopped visiting, so a board whose cards reached Done or Canceled before trust was recorded gets its answers on the next sweep instead of never. The board's External mark reads a recorded answer instead of the absence of one, so a card nobody was ever asked about is no longer labelled an outside contribution. The execution-consent gate is unchanged: a card with no recorded answer still asks for a person before it starts a run.
