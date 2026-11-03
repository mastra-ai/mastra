import { Trash2 } from 'lucide-react';
import type { Ref } from 'react';

import type { ChatQuote } from './chat-quotes';
import { QuoteNumber } from './quote-number';
import { Button } from '@/ds/components/Button';
import { Textarea } from '@/ds/components/Textarea';
import { Txt } from '@/ds/components/Txt';

export interface QuoteCommentCardProps {
  quote: ChatQuote;
  number: number;
  commentRef?: Ref<HTMLTextAreaElement>;
  onCommentChange: (comment: string) => void;
  onRemove: () => void;
  onDone: () => void;
}

/** What opens from an annotation's mark: its passage, a comment that goes out with it, and removal. */
export function QuoteCommentCard({
  quote,
  number,
  commentRef,
  onCommentChange,
  onRemove,
  onDone,
}: QuoteCommentCardProps) {
  return (
    <div data-slot="quote-comment-card" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <QuoteNumber>{number}</QuoteNumber>
        <Txt as="span" variant="label" className="flex-1">
          Annotation {number}
        </Txt>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-my-1 -me-1"
          tooltip={`Remove annotation ${number}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <blockquote className="line-clamp-3 border-l-2 border-info-indicator ps-2.5 text-body-sm whitespace-pre-line text-muted-foreground">
        {quote.text}
      </blockquote>
      <Textarea
        ref={commentRef}
        aria-label={`Comment on annotation ${number}`}
        placeholder="Add a comment"
        rows={3}
        className="min-h-18 resize-none"
        value={quote.comment ?? ''}
        onChange={event => onCommentChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onDone();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <Txt as="span" variant="caption" tone="muted">
          Sent with your next message
        </Txt>
        <Button type="button" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
