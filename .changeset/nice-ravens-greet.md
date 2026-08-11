---
'@mastra/playground-ui': minor
---

Added anchored turn positioning to `MessageScroller`. Newly added rows marked with `scrollAnchor` move toward the top of the viewport, while `defaultScrollPosition="last-anchor"` opens saved transcripts at their latest turn.

Streaming replies can now grow beneath the current prompt without shifting the reading position. Completed replies retain that space until the next anchored turn arrives.

```tsx
<MessageScrollerProvider defaultScrollPosition="last-anchor">
  <MessageScrollerViewport>
    <MessageScrollerContent>
      <MessageScrollerItem messageId="turn-1" scrollAnchor>
        <p>How do I deploy this workflow?</p>
      </MessageScrollerItem>
    </MessageScrollerContent>
  </MessageScrollerViewport>
</MessageScrollerProvider>
```
