---
'@mastra/playground-ui': major
---

`ChatShell` now docks the composer under the transcript instead of inside it. The transcript and its scrollbar end at the top of the composer, the transcript fades out above it, and the composer no longer bounces when you scroll past either end in Chrome.

**Migrating**

Move `ChatShell.Dock` out of `ChatShell.Viewport` so it follows it inside `ChatShell.Stage`. A dock left inside the viewport now scrolls away with the transcript.

```tsx
// Before
<ChatShell.Stage>
  <ChatShell.Viewport>
    <ChatShell.Content>{transcript}</ChatShell.Content>
    <ChatShell.Dock>{composer}</ChatShell.Dock>
  </ChatShell.Viewport>
</ChatShell.Stage>

// After
<ChatShell.Stage>
  <ChatShell.Viewport>
    <ChatShell.Content>{transcript}</ChatShell.Content>
  </ChatShell.Viewport>
  <ChatShell.Dock>{composer}</ChatShell.Dock>
</ChatShell.Stage>
```

`--chat-fade` (now `2rem`) is the band the transcript fades out across at the bottom of the scroller, and `--chat-veil` (now `100%`) is how strong that fade gets.
