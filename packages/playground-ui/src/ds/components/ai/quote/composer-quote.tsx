import { TextQuote, X } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

import { Button } from '@/ds/components/Button';
import { ComposerHeaderActions, ComposerHeaderContent, ComposerHeaderRow } from '@/ds/components/Composer';
import { cn } from '@/lib/utils';

export interface ComposerQuoteProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** The quoted text. A long quote shows its first two lines. */
  children: string;
  onRemove: () => void;
}

/** One quote waiting in `ComposerHeader` to go out with the next message. */
export function ComposerQuote({ children, onRemove, className, ...props }: ComposerQuoteProps) {
  return (
    <ComposerHeaderRow data-slot="composer-quote" className={cn('flex-nowrap items-start', className)} {...props}>
      <TextQuote aria-hidden="true" className="mt-0.5" />
      <ComposerHeaderContent>
        <blockquote className="line-clamp-2 whitespace-pre-line">{children}</blockquote>
      </ComposerHeaderContent>
      <ComposerHeaderActions className="-my-1">
        <Button type="button" variant="ghost" size="icon-sm" tooltip="Remove quote" onClick={onRemove}>
          <X />
        </Button>
      </ComposerHeaderActions>
    </ComposerHeaderRow>
  );
}
