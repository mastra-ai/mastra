---
'@mastra/playground-ui': minor
---

Added annotation components for chat UIs, so a person can point the agent at parts of the transcript:

- `QuoteSelectionToolbar` shows **Add to chat** over text selected in a message.
- `QuoteMarkers` numbers each annotation where it was selected and tints its text. Render it inside the scrolled transcript so the marks move with the text.
- `ComposerQuotes` shows the annotations as one chip in `ComposerBox` that opens their numbered list.
- `ChatQuotesProvider` and `useChatQuotes` share them between the transcript and the composer.
- `formatQuotedMessage` turns them into Markdown blockquotes ahead of the typed text.

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
const { quotes, addQuote, removeQuote } = useChatQuotes();

<div ref={transcriptRef} className="relative">
  <QuoteMarkers quotes={quotes} />
  {messages}
</div>;
<QuoteSelectionToolbar containerRef={transcriptRef} onQuote={addQuote} />;

<ComposerBox>
  <ComposerQuotes quotes={quotes} onRemove={removeQuote} />
  <ComposerInput />
</ComposerBox>;

const quoted = quotes.map(quote => quote.text);
send(formatQuotedMessage(draft, quoted));
```
