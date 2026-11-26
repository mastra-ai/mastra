---
'@mastra/factory': minor
---

Factory board sessions now report an outcome instead of moving their card. Each working phase lists the outcomes its session may report, and Factory moves the card when the run ends.

```ts
planning: {
  kind: 'working',
  nextPhases: ['execute', 'intake'],
  outcomes: [
    { key: 'advance', label: 'Plan approved', to: 'execute' },
    { key: 'rest', label: 'Needs a person', to: 'intake' },
  ],
}
```

Sessions call `factory_report_outcome({ outcome, reason })`; they no longer get `factory_transition_work_item`. An approved `submit_plan` reports `advance`, and a self-review that requests changes sends the card back to Building. A phase without `outcomes` offers one per next phase. An outcome whose `to` is not one of the phase's `nextPhases` fails the board's compile. Existing Work boards get the new outcomes and Building goal on load.
