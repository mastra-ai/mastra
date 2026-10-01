---
'@mastra/playground-ui': patch
---

The trace thread view now separates each turn with a divider reading "Turn N · Messages / Feedback / Scores" instead of a bordered grid with a tab bar, and shows each turn's span tree in a raised card. The divider's line runs across the full width, while the turn label and tabs sit above the messages column only. A long span tree fades out at the bottom, and an Expand / Collapse button sits in the card header.

`TranscriptDivider` accepts optional `children` (such as tabs or actions), rendered after the label behind a `·` separator:

```tsx
<TranscriptDivider label="Turn 1">
  <TabList>…</TabList>
</TranscriptDivider>
```
