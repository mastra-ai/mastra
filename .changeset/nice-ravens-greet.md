---
'@mastra/playground-ui': minor
---

Chat transcripts now lift each new turn toward the top of the viewport instead of following the bottom of the stream. Send a message and it climbs clear of the composer while the reply fills the room below it, so you read an answer from its first line rather than watching it slide past. Scrolling up no longer fights you, and the jump-to-latest button brings you back.

The room a turn climbs into is plain CSS: the scroller viewport is a size container, and a chat surface gives its last turn a minimum height in `cqh`. Nothing measures or resizes anything while a reply streams, so the composer stays perfectly still. The room also stays once the reply finishes — taking it away would shift what you are reading — and simply moves to the next turn when you send again.

`MessageScroller` reads the turns from the rows you already mark with `scrollAnchor`. Open a saved thread on its last turn and reserve room under it with:

```tsx
<MessageScrollerProvider defaultScrollPosition="last-anchor">
```

```tsx
<div className={isLiveTurn ? 'min-h-[50cqh]' : undefined}>{turnRows}</div>
```
