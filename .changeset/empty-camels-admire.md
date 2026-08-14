---
'@mastra/playground-ui': minor
---

Improved `MessageScroller` so chat transcripts follow the stream. With `autoScroll` on, the reader is carried with the newest output while they sit at the end, and a new user turn brings them back to it. Only scrolling away stops the following — content growing under the reader, or landing above them, no longer moves them or flashes the jump-to-end button.

A turn opening animates the scroll only for a reader who had scrolled away. Someone already at the end is carried by whatever the turn grows under itself, so a surface can reserve room under a live turn and let its own transition set the pace:

```tsx
<MessageScrollerProvider autoScroll>
  <MessageScrollerViewport>
    <MessageScrollerContent>
      {/* the viewport is a size container, so a live turn can reserve a share of it */}
      <div className="min-h-[70cqh]">{liveTurn}</div>
    </MessageScrollerContent>
  </MessageScrollerViewport>
</MessageScrollerProvider>
```
