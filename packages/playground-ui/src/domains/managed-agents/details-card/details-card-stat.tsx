import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface DetailsCardStatProps {
  label: string;
  value: ReactNode;
}

export function DetailsCardStats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
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
