import { LockIcon } from 'lucide-react';
import { SAVED_VIEW_SCOPE_LABEL } from './use-saved-views';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function SavedViewScope({ className }: { className?: string }) {
  return (
    <Txt
      as="span"
      variant="caption"
      tone="muted"
      className={cn('flex shrink-0 items-center gap-1 [&_svg]:size-3', className)}
    >
      <LockIcon aria-hidden />
      {SAVED_VIEW_SCOPE_LABEL}
    </Txt>
  );
}
