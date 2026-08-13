---
'@mastra/playground-ui': minor
---

Added a `streaming` prop to `MarkdownRenderer`. A reply marked as still being written fades each word in as it arrives, instead of snapping whole chunks of text into place.

```tsx
<MarkdownRenderer streaming={part.state === 'streaming'}>{part.text}</MarkdownRenderer>
```

The fade is CSS on words as they land, so the text already on screen stays put while the reply grows. A word fades in once it is whole rather than one character at a time — the word still being typed is held back until its boundary arrives, so the visible text trails the stream by at most one word. One caveat: when a growing block changes shape, a paragraph turning into a list item as the next character lands, that block fades again.

Leave the prop off — the default — for text that is already settled: it renders as plain prose, with no extra markup. The animation is disabled under `prefers-reduced-motion`.

Markdown no longer sets `text-wrap: pretty`. It re-broke the last lines of a block to avoid orphans, which reran on every chunk of a streaming reply and jumped words that were already on screen onto another line.
