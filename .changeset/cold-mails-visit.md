---
'@mastra/playground-ui': minor
---

Streamed replies now arrive one word at a time instead of in bursts.

Chunks reach the browser unevenly — a proxy flushes, a tool call ends, the model changes pace — so a reply used to lurch: ten words at once, then nothing for a fifth of a second. `MarkdownRenderer` now paces a reply marked `streaming` itself, revealing it one word at a time at the speed the reply is actually arriving. Bursts and gaps stop reaching the page, and a change of pace reads as one rather than as a jolt.

```tsx
<MarkdownRenderer streaming={part.state === 'streaming'}>{part.text}</MarkdownRenderer>
```

Each word fades in as it lands, and code fades in whole — a fence or a piece of inline code appears with its background rather than a token at a time. A word fades in once and only once, so a paragraph never flickers as the rest of the reply arrives behind it.

A thread opened from history renders whole. A reply opened part-written joins it rather than retyping it, and what was already on screen when you opened it stays put: only the words landing from then on animate. Readers who ask for reduced motion get the text at once, unanimated.
