/* eslint-disable react-refresh/only-export-components -- the provider and its hook share one context */
import { nanoid } from 'nanoid';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { normalizeQuote } from './format-quoted-message';
import type { QuoteSource } from './quotable-selection';

export type { QuoteSource } from './quotable-selection';

/** A passage waiting to go out with the next message. People see it as a numbered annotation. */
export interface ChatQuote {
  id: string;
  text: string;
  /** Where it was selected, so the transcript can mark it. */
  source?: QuoteSource;
}

export type NewChatQuote = Omit<ChatQuote, 'id'>;

export interface ChatQuotesApi {
  /** Quotes waiting for the next message, in the order they were added. Their number is their position. */
  quotes: ChatQuote[];
  /** Adds a quote. Blank text, and a passage already waiting, are ignored. */
  addQuote: (quote: NewChatQuote) => void;
  removeQuote: (id: string) => void;
  /** Puts quotes from a message that failed to send back, ahead of any added since. */
  restoreQuotes: (quotes: readonly ChatQuote[]) => void;
}

const ChatQuotesContext = createContext<ChatQuotesApi | undefined>(undefined);

const samePassage = (a: NewChatQuote, b: NewChatQuote) =>
  a.source && b.source
    ? a.source.element === b.source.element && a.source.start === b.source.start && a.source.end === b.source.end
    : a.text === b.text;

/**
 * Shares quotes between the transcript that adds them and the composer that sends them. Mount it
 * once per conversation, below whatever remounts when the thread changes, so quotes stay with
 * their thread.
 */
export function ChatQuotesProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<ChatQuote[]>([]);

  const value: ChatQuotesApi = {
    quotes,
    addQuote: ({ text, source }) => {
      const quote = { text: normalizeQuote(text), source };
      if (!quote.text) return;
      setQuotes(current =>
        current.some(waiting => samePassage(waiting, quote)) ? current : [...current, { id: nanoid(), ...quote }],
      );
    },
    removeQuote: id => setQuotes(current => current.filter(quote => quote.id !== id)),
    restoreQuotes: restored =>
      setQuotes(current => [...restored.filter(quote => !current.some(kept => kept.id === quote.id)), ...current]),
  };

  return <ChatQuotesContext.Provider value={value}>{children}</ChatQuotesContext.Provider>;
}

export function useChatQuotes(): ChatQuotesApi {
  const value = useContext(ChatQuotesContext);
  if (!value) throw new Error('useChatQuotes must be used within a ChatQuotesProvider');
  return value;
}
