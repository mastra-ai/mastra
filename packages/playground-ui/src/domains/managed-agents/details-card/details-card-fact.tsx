import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface DetailsCardFactProps {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

export function DetailsCardFact({ icon, label, value }: DetailsCardFactProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span aria-hidden="true" className="flex size-icon-sm shrink-0 items-center justify-center [&>*]:size-full">
            {icon}
          </span>
        ) : null}
        <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate">
          {label}
        </Txt>
      </span>
      <Txt as="span" variant="body-sm" tone="muted" className="shrink-0">
        {value}
      </Txt>
    </div>
  );
}
