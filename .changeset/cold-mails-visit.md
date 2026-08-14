---
'@mastra/playground-ui': minor
---

Streamed replies now arrive one word at a time instead of in bursts.

Chunks reach the browser unevenly — a proxy flushes, a tool call ends, the model changes pace — and rendering each one on arrival makes a reply lurch: ten words at once, then nothing for a fifth of a second. `MarkdownRenderer` now buffers a reply marked `streaming` and plays it back on its own frame clock, laying down at most one word per frame. It measures the speed the reply is arriving at and plays at that speed, holding about a second of text back so a burst or a gap is absorbed rather than shown, and easing into a new speed instead of tracking one.

```tsx
<MarkdownRenderer streaming={part.state === 'streaming'}>{part.text}</MarkdownRenderer>
```

Each word fades in as it lands, and code fades in whole — a fence or a piece of inline code appears with its background rather than a token at a time. A word keeps the element it arrived in for good and never gains its entrance twice, so a paragraph that re-renders mid-reply redraws rather than replays.

A thread opened from history renders whole. A reply opened part-written joins it rather than retyping it, and what was already on screen when you opened it stays put: only the words landing from then on animate. Readers who ask for reduced motion get the text at once, unanimated.
