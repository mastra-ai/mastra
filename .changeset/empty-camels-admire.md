---
'@mastra/playground-ui': minor
---

Chat transcripts now follow the stream. With `autoScroll` on, `MessageScroller` carries the reader with the newest output while they are attached to the end, and a new user turn re-attaches them there. Only the reader can detach it, by scrolling away — content growing under them cannot, which is what used to flash the jump-to-end button for a moment on every send and yank the view back up to the last user message on tool progress.

Content that lands above the reader mid-run (a temporal gap separator, a late tool row) no longer shifts what they are reading.

A turn opening only animates the scroll for a reader who had scrolled away and has to be brought back. Someone already at the end is carried by whatever the turn grows under itself, so its transition — not a competing scroll animation — sets the pace:

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

A surface that follows the stream can transition that min-height to `0` when the run ends, and the follow glides the transcript down with it instead of dropping it.
