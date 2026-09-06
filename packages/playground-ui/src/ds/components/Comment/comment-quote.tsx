import { X } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface CommentQuoteProps {
  authorName?: string;
  quote: string;
  /** Given only while the quote is a draft the writer can still drop. */
  onDismiss?: () => void;
  className?: string;
}

/** The passage a reply answers, above the reply itself or inside the composer writing it. */
export function CommentQuote({ authorName, quote, onDismiss, className }: CommentQuoteProps) {
  return (
    <blockquote
      data-slot="comment-quote"
      className={cn('text-neutral3 m-0 flex min-w-0 gap-2 border-l-2 border-border2 pl-2 text-ui-xs', className)}
    >
      <span className="min-w-0 flex-1">
        {authorName ? <span className="text-neutral4 font-medium">{authorName} </span> : null}
        <span className="line-clamp-2 wrap-anywhere whitespace-pre-line">{quote}</span>
      </span>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Remove quote"
          onClick={onDismiss}
          className="shrink-0"
        >
          <X size={12} aria-hidden />
        </Button>
      ) : null}
    </blockquote>
  );
}
