/* eslint-disable react-refresh/only-export-components -- the provider and its hook share one context */
import { nanoid } from 'nanoid';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { normalizeQuote } from './format-quoted-message';

export interface ChatQuote {
  id: string;
  text: string;
}

export interface ChatQuotesApi {
  /** Quotes waiting for the next message, oldest first. */
  quotes: ChatQuote[];
  /** Adds the text as a quote. Blank text and a quote already waiting are ignored. */
  addQuote: (text: string) => void;
  removeQuote: (id: string) => void;
  /** Puts quotes from a message that failed to send back, ahead of any added since. */
  restoreQuotes: (quotes: readonly ChatQuote[]) => void;
}

const ChatQuotesContext = createContext<ChatQuotesApi | undefined>(undefined);

/**
 * Shares quotes between the transcript that adds them and the composer that sends them. Mount it
 * once per conversation, below whatever remounts when the thread changes, so quotes stay with
 * their thread.
 */
export function ChatQuotesProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<ChatQuote[]>([]);

  const value: ChatQuotesApi = {
    quotes,
    addQuote: text => {
      const normalized = normalizeQuote(text);
      if (!normalized) return;
      setQuotes(current =>
        current.some(quote => quote.text === normalized) ? current : [...current, { id: nanoid(), text: normalized }],
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
