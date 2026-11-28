import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface DocumentEditorFactProps {
  label: ReactNode;
  value: ReactNode;
}

export function DocumentEditorFact({ label, value }: DocumentEditorFactProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate">
        {label}
      </Txt>
      <Txt as="span" variant="body-sm" tone="muted" className="shrink-0">
        {value}
      </Txt>
    </div>
  );
}
