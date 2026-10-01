---
'@mastra/playground-ui': patch
---

The trace thread view now separates each turn with a full-width divider holding a "Go to trace" link and the Messages / Feedback / Scores tabs, instead of a bordered grid with a tab bar. Each turn's span tree sits in a raised card. A long span tree fades out at the bottom: click the fade or its Expand button to reveal it, and use the Collapse button under the tree to clamp it again. The view now loads in a single step: one skeleton until the turns and their spans are ready, with no blank panel, per-row skeletons or stale rows from the previous thread.

`CollapsibleBox`: clicking the faded area now expands the box, and the new `expandLabel` prop adds an Expand button at the bottom of the fade:

```tsx
<CollapsibleBox state={state} expandLabel="Expand">
  …
</CollapsibleBox>
```

`TranscriptDivider` accepts optional `children` (such as tabs or actions), and `hideLabel` hides the visible label while keeping it as the accessible name:

```tsx
<TranscriptDivider label="Turn 1" hideLabel>
  <TabList>…</TabList>
</TranscriptDivider>
```
