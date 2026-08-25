---
'@mastra/playground-ui': patch
---

Improved how streaming transcripts move, and added the arrival primitives behind it.

**Fixed**

- Words already read no longer replay their entrance when markdown rebuilds around them, and a reply born streaming animates from its very first word instead of landing as a block that fades in.
- The reveal clock no longer steps backwards for one frame, which unmounted a settled tool row and cut its shimmer off mid-sweep.
- The shimmer on running labels is a single band scaled to the element instead of a tiled pattern, and it dissolves into the text colour when the label lands instead of snapping off.
- `MessageScroller` follows the last message instead of the end of its box, so the reader is no longer parked on empty space below the conversation. Catch-up while following a stream is softened on the compositor, and opening a turn parks the sent message at the top and lets the answer grow beneath it.

**Added**

- `ArrivalScope`, `useWatched` and `Arriving`: one shared answer to "was the reader watching when this mounted", so every entrance derives from it.
- `useRevealedText`: the word-by-word pacing, moved out of `MarkdownRenderer` so a caller can lay tool rows and cards down in the same rhythm as the prose. `streaming` on `MarkdownRenderer` now only means "this text is a prefix still being written".

```tsx
const shown = useRevealedText(text, streaming);

<MarkdownRenderer streaming={streaming || shown !== text}>{shown}</MarkdownRenderer>;
```

**Changed**

- `Shimmer` takes `active` and stays one element across the switch, so nothing inside it remounts when a label lands:

```tsx
// before: a different element per state, remounting everything inside on landing
const Header = status === 'running' ? Shimmer : 'span';

// after
<Shimmer active={status === 'running'}>{label}</Shimmer>;
```

- Renamed the entrance class `mastra-markdown-arriving` to `mastra-arriving`, exported as `ARRIVING_CLASS` from `@mastra/playground-ui/tokens`.
