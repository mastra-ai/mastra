import { QuoteMarkers, QuoteSelectionToolbar, useChatQuotes } from '@mastra/playground-ui/components/ai/quote';
import type { RefObject } from 'react';

import { useChatCommands } from '../context/ChatCommandsProvider';

/**
 * Add to chat over text selected in a message, and the numbered marks of what was added. The marks
 * sit in the scrolled chat content, so they move with the text; adding one focuses the composer.
 */
export function TranscriptAnnotations({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const { quotes, addQuote, removeQuote, setQuoteComment } = useChatQuotes();
  const { composerInputRef } = useChatCommands();

  return (
    <>
      <QuoteMarkers quotes={quotes} onRemove={removeQuote} onCommentChange={setQuoteComment} />
      <QuoteSelectionToolbar
        containerRef={containerRef}
        onQuote={quote => {
          addQuote(quote);
          composerInputRef.current?.focus();
        }}
      />
    </>
  );
}
