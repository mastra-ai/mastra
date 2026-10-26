---
'@mastra/factory': minor
---

Factory's own tools now follow the card's phase instead of the session's role. While a card is in Triage, any agent working it reports a triage classification; while it is in Review, a reviewer gets `factory_record_review_verdict` and `factory_review_source`, and loses them once the card moves on. The session that builds a card still never records a verdict on it. A phase's exit tool (such as `submit_plan`) now moves the card from any agent working it in that phase.

Code boards declare grants per phase with `factoryTools`; a working phase seating `review` keeps the review tools by default.

```ts
defineBoard({
  // ...
  phases: {
    qa: { title: 'QA', kind: 'working', role: 'qa', factoryTools: ['review'] },
  },
});
```
