---
'@mastra/playground-ui': minor
---

Added quote components for chat UIs. `QuoteSelectionToolbar` shows **Add to chat** over text selected in a message, `ComposerQuote` shows each waiting quote in `ComposerHeader` with a remove button, `ChatQuotesProvider` and `useChatQuotes` share the quotes between the transcript and the composer, and `formatQuotedMessage` turns them into Markdown blockquotes ahead of the typed text.

```tsx
import {
  ChatQuotesProvider,
  ComposerQuote,
  formatQuotedMessage,
  QuoteSelectionToolbar,
  useChatQuotes,
} from '@mastra/playground-ui/components/ai/quote';

// Inside <ChatQuotesProvider>:
const { quotes, addQuote, removeQuote } = useChatQuotes();

<QuoteSelectionToolbar containerRef={transcriptRef} onQuote={addQuote} />;

<ComposerHeader open={quotes.length > 0}>
  {quotes.map(quote => (
    <ComposerQuote key={quote.id} onRemove={() => removeQuote(quote.id)}>
      {quote.text}
    </ComposerQuote>
  ))}
</ComposerHeader>;

const quoted = quotes.map(quote => quote.text);
send(formatQuotedMessage(draft, quoted));
```
