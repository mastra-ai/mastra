import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MeterKeyRow({ swatch, label, amount }: { swatch: string; label: ReactNode; amount: string }) {
  return (
    <div data-slot="meter-key-row" className="flex items-center gap-2">
      <span aria-hidden className={cn('size-2 rounded-xs', swatch)} />
      <Txt as="span" variant="caption" tone="muted" className="max-w-48 min-w-0 flex-1 truncate">
        {label}
      </Txt>
      <span className="ml-auto pl-4 text-foreground tabular-nums">{amount}</span>
    </div>
  );
}
