---
'@mastra/playground-ui': patch
---

The markdown entrance animation is now a shared `mastra-arriving` class in `theme.css`, exported as `ARRIVING_CLASS` from `@mastra/playground-ui/tokens`, so any surface can land a block on the same curve as a streamed word. Renamed from `mastra-markdown-arriving`.

The shimmer on running labels is one sweep again. It tiled a fixed 120px gradient, so a long tool row showed three or four highlights travelling at once; it is now a single band scaled to the element, eased so it crosses the text quickly and turns around out of sight.

`MessageScroller` now softens the catch-up it does while following a stream. Pinning to the end is still instant, but the content is put back where the reader last saw it and travels to zero on the compositor, so a reply that wraps a line no longer snaps.

`MessageScroller` follows the last row rather than the end of its box. A chat reserves room under a live turn and docks its composer in the flow, and both sit below the last message — so scrolling to the end of the box parked the reader on empty space and carried the message they had just sent off the top. Every trip to "the end" — following a stream, landing on open, the jump-to-latest button — now stops with the last row resting against the end of the view.

A turn opening is also one scripted scroll instead of a pin: the message that opened it is parked at the top, whether or not the reader was following. The answer then grows into the room under it and moves nothing at all; the scroller only takes over once the answer outgrows the screen.

A streamed word now animates only while it is new. The entrance plays on whatever mounts carrying the class, and markdown rebuilds a growing tail constantly — a `-` turning a paragraph into a list item, a closing `**`, the stream ending — so a word already read faded in again every time the element around it changed. `MarkdownRenderer` ages its words out of the entrance instead, and a block whose words have all landed renders as plain text.

`Shimmer` takes `active` and is one element whatever it says:

```tsx
// before: a different element per state, remounting everything inside on landing
const Header = status === 'running' ? Shimmer : 'span';

// after
<Shimmer active={status === 'running'}>{label}</Shimmer>;
```

The sweep also lands rather than stopping: the band freezes where it stands and dissolves into the text colour, instead of snapping off mid-pass.

Pacing a streamed reply moved out of `MarkdownRenderer` and into `useRevealedText`, exported alongside it. A reply is rarely only prose — tool rows and cards are written between its passages — and a component that paced its own text left the caller no way to lay the rest down in the same order. `streaming` on `MarkdownRenderer` now means only "this text is a prefix still being written: close the markers the stream has not reached".

```tsx
const shown = useRevealedText(text, streaming);

<MarkdownRenderer streaming={streaming || shown !== text}>{shown}</MarkdownRenderer>;
```
