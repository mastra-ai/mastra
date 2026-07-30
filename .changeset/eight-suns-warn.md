---
'@mastra/playground-ui': minor
---

Added `ChatShell`, a chat page frame with a single scroll container. Bars sit above the scroller, the composer docks inside it as `sticky bottom-0`, and every region — transcript, notices, task list, composer — is centred by one `ChatShell.Column`. That removes the band of background that used to separate the transcript from the composer, and keeps absolutely positioned affordances such as jump-to-latest anchored to the shell instead of escaping to a full-width page wrapper and centring on the wrong axis.

```tsx
<ChatShell
  className="[--chat-column:44rem]"
  scroller={{ autoScroll: true, preserveScrollOnPrepend: true, onReachStart: loadOlderHistory }}
>
  <ChatShell.Bar>
    <SessionHeader />
  </ChatShell.Bar>
  <ChatShell.Stage>
    <ChatShell.Viewport>
      <ChatShell.Content>
        <ChatShell.Column>{messages}</ChatShell.Column>
      </ChatShell.Content>
      <ChatShell.Dock>
        <ChatShell.ScrollButton />
        <ChatShell.Column>
          <Composer />
        </ChatShell.Column>
      </ChatShell.Dock>
    </ChatShell.Viewport>
  </ChatShell.Stage>
</ChatShell>
```

The dock keeps its place in flow, so its own height is the room the transcript scrolls behind and nothing has to measure it. A composer that grows as the reader types therefore leaves the transcript exactly where it was, instead of dragging it up a line at a time.

Custom properties tune it: `--chat-column` for the column width, `--chat-surface` for the page colour, `--chat-gutter` for the room kept above and below the composer, `--chat-veil` for what the dock paints with (translucent by default, so a line passing behind the composer stays faintly readable), and `--chat-inset-end` for room an overlay panel claims on the end edge.

**MessageScroller** `MessageScrollerProvider` gained `onReachStart`, called when the reader reaches the start of the transcript, and `preserveScrollOnPrepend`, which holds the reading position when older messages land above the current ones. `autoScroll` now also follows content that grows mid-stream, and leaves a reader who scrolled away alone instead of pulling them back to the end. `preserveScrollOnPrepend` moved off `MessageScrollerViewport`, where it set a data attribute and nothing else. `MessageScrollerItem` no longer throws outside a scroller, so the same row renderer can be reused on draft pages and previews. `MessageScrollerButton` now carries a minimum size and a soft two-layer shadow, so it reads as a floating control rather than a bare icon.

**Migration**

```tsx
// Before
<MessageScrollerViewport preserveScrollOnPrepend />

// After
<MessageScrollerProvider preserveScrollOnPrepend>
  <MessageScrollerViewport />
</MessageScrollerProvider>
```
