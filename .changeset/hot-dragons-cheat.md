---
'@mastra/factory': minor
---

Added `skipRules` to `upsertLinkedWorkItem` decisions so a rule can file a card directly on a stage it names, with none of the board's phase rules run for it.

External records that arrive already past a board's first step no longer have to pass through it. Set `skipRules: true` on the decision to place the card on `stage` as its first entry: no arrival rule, no destination-entry rule, no transition row, and nothing started for the card.

```ts
issueOpened: context => {
  const decision = defaultGithubRules.issueOpened(context);
  if (!decision) return decision;
  // Triage already happened upstream: file it on Planning and leave it there.
  return { ...decision, stage: 'planning', skipRules: true };
};
```

The same decision on an existing card relocates it — used by the GitHub issue reconciliation sweep, which now replays an open issue through the rules ingress when its labels changed, so label-derived placement is re-applied even when the `labeled` webhook never arrived. `moveCardToBoard` now takes an optional `targetStage`, so a placement can name a phase on the card's own board (Work › Intake to Work › Planning), not just a board's landing phase. Relocation guards still apply: terminal cards, cards with a session on their current phase's role, and cards that changed under the dispatcher stay put.
