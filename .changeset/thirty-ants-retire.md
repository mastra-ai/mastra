---
'@mastra/playground-ui': minor
---

Added annotation components for chat UIs, so a person can point the agent at parts of the transcript and comment on them:

- `QuoteSelectionToolbar` shows **Add to chat** over text selected in a message.
- `QuoteMarkers` marks each annotation with a numbered comment bubble where it was selected and tints its text. Hovering a bubble deepens the tint; clicking it opens a card to comment on the passage or remove it. Render it inside the scrolled transcript so the bubbles move with the text.
- `ComposerQuotes` shows the annotations as one chip in `ComposerBox` that opens their numbered list.
- `ChatQuotesProvider` and `useChatQuotes` share them, and their comments, between the transcript and the composer.
- `formatQuotedMessage` turns them into a numbered Markdown list, each passage quoted with its comment, ahead of the typed text.

```tsx
import {
  ChatQuotesProvider,
  ComposerQuotes,
  formatQuotedMessage,
  QuoteMarkers,
  QuoteSelectionToolbar,
  useChatQuotes,
} from '@mastra/playground-ui/components/ai/quote';

// Inside <ChatQuotesProvider>:
const { quotes, addQuote, removeQuote, setQuoteComment } = useChatQuotes();

<div ref={transcriptRef} className="relative">
  <QuoteMarkers quotes={quotes} onRemove={removeQuote} onCommentChange={setQuoteComment} />
  {messages}
</div>;
<QuoteSelectionToolbar containerRef={transcriptRef} onQuote={addQuote} />;

<ComposerBox>
  <ComposerQuotes quotes={quotes} onRemove={removeQuote} />
  <ComposerInput />
</ComposerBox>;

send(formatQuotedMessage(draft, quotes));
```
