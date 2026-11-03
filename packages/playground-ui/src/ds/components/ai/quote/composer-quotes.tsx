import { TextQuote, X } from 'lucide-react';
import { useState } from 'react';

import type { ChatQuote } from './chat-quotes';
import { rangeFromSource } from './quotable-selection';
import { QuoteNumber } from './quote-number';
import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ComposerQuotesProps {
  quotes: readonly ChatQuote[];
  onRemove: (id: string) => void;
}

const countLabel = (count: number) => (count === 1 ? '1 annotation' : `${count} annotations`);

/** Scrolls the transcript to where the quote was selected, if that message is still on the page. */
function revealSource(quote: ChatQuote): boolean {
  const range = quote.source && rangeFromSource(quote.source);
  const target = range?.startContainer.parentElement;
  if (!target) return false;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

/**
 * The quotes waiting for the next message, as one chip at the top of `ComposerBox`. It opens their
 * numbered list, where each one can be found in the transcript or removed. Renders nothing while
 * no quote is waiting.
 */
export function ComposerQuotes({ quotes, onRemove }: ComposerQuotesProps) {
  const [open, setOpen] = useState(false);
  if (quotes.length === 0) return null;

  return (
    <div data-slot="composer-quotes" className="flex px-2 pt-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger type="button" size="sm">
          <TextQuote aria-hidden="true" />
          {countLabel(quotes.length)}
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 p-1.5">
          <ol aria-label="Annotations" className="flex flex-col">
            {quotes.map((quote, index) => (
              <li key={quote.id} className="flex items-start gap-2 rounded-lg p-1.5">
                <QuoteNumber className="mt-px">{index + 1}</QuoteNumber>
                {quote.source ? (
                  <button
                    type="button"
                    title="Show in chat"
                    className={cn(
                      'line-clamp-3 min-w-0 flex-1 cursor-pointer rounded-xs text-left text-body-sm whitespace-pre-line text-muted-foreground hover:text-foreground',
                      focusRing,
                    )}
                    onClick={() => {
                      if (revealSource(quote)) setOpen(false);
                    }}
                  >
                    {quote.text}
                  </button>
                ) : (
                  <p className="line-clamp-3 min-w-0 flex-1 text-body-sm whitespace-pre-line text-muted-foreground">
                    {quote.text}
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-my-1"
                  tooltip={`Remove annotation ${index + 1}`}
                  onClick={() => onRemove(quote.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ol>
          {quotes.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={() => {
                for (const quote of quotes) onRemove(quote.id);
              }}
            >
              Remove all
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
