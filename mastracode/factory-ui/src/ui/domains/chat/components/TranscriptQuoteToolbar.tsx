import { QuoteSelectionToolbar, useChatQuotes } from '@mastra/playground-ui/components/ai/quote';
import type { RefObject } from 'react';

import { useChatCommands } from '../context/ChatCommandsProvider';

/** Add to chat over text selected in a message: the quote waits in the composer header, which takes focus. */
export function TranscriptQuoteToolbar({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const { addQuote } = useChatQuotes();
  const { composerInputRef } = useChatCommands();

  return (
    <QuoteSelectionToolbar
      containerRef={containerRef}
      onQuote={text => {
        addQuote(text);
        composerInputRef.current?.focus();
      }}
    />
  );
}
