import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt/Txt';

export type EntryProps = {
  label: ReactNode;
  children: ReactNode;
};

export const Entry = ({ label, children }: EntryProps) => {
  return (
    <div className="space-y-2">
      <Txt as="p" variant="body" tone="muted">
        {label}
      </Txt>

      {children}
    </div>
  );
};
