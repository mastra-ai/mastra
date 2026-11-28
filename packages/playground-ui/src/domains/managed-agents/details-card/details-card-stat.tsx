import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface DetailsCardStatProps {
  label: string;
  value: ReactNode;
}

export function DetailsCardStat({ label, value }: DetailsCardStatProps) {
  return (
    <div className="flex flex-col">
      <Txt as="span" variant="card-title" tone="ink" className="tabular-nums">
        {value}
      </Txt>
      <Txt as="span" variant="caption" tone="muted">
        {label}
      </Txt>
    </div>
  );
}
