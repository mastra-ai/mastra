---
'@mastra/playground-ui': minor
---

Added a `streaming` prop to `MarkdownRenderer`. A reply marked as still being written fades each word in as it arrives, instead of snapping whole chunks of text into place.

```tsx
<MarkdownRenderer streaming={part.state === 'streaming'}>{part.text}</MarkdownRenderer>
```

The fade is CSS on words that just mounted, so the text already on screen stays put and nothing re-animates as the reply grows. Leave the prop off — the default — for text that is already settled: it renders as plain prose, with no extra markup. The animation is disabled under `prefers-reduced-motion`.
