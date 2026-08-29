import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';

/** A quoted reply being composed; owned by the mount parent so list and composer share it. */
export interface CommentQuoteDraft {
  commentId: string;
  quote: string;
  authorName?: string;
}

export function CommentQuote({
  authorName,
  quote,
  onDismiss,
  className,
}: {
  authorName?: string;
  quote: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <blockquote
      className={cn('border-border2 text-ui-xs text-icon3 m-0 flex min-w-0 gap-2 border-l-2 pl-2', className)}
    >
      <span className="min-w-0 flex-1">
        {authorName ? <span className="text-icon4 font-medium">{authorName} </span> : null}
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
