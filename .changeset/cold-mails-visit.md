---
'@mastra/playground-ui': minor
---

Streamed replies now render at a steady pace instead of in bursts.

Chunks reach the browser unevenly — a proxy flushes, a tool call ends, the model changes pace — and rendering each one on arrival makes a reply lurch: five words appear at once, then nothing for a fifth of a second. A new `useSmoothText` hook sits between the arriving text and the renderer and reveals it at a rate set by how far behind it is, so a burst spreads out and a gap closes rather than stalling. On a stream flushing 34 characters every 130ms, that turns 33-character jumps into 4-character steps, one per frame.

```tsx
import { useSmoothText } from '@mastra/playground-ui/hooks/use-smooth-text';

const revealed = useSmoothText(part.text);

return <MarkdownRenderer streaming={part.streaming || revealed !== part.text}>{revealed}</MarkdownRenderer>;
```

Whatever is on screen when the hook mounts counts as already read, so a thread opened from history renders whole. Readers who ask for reduced motion get the text at once.
