import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface DocumentEditorSectionProps {
  label: string;
  children: ReactNode;
}

export function DocumentEditorSection({ label, children }: DocumentEditorSectionProps) {
  return (
    <section className="flex flex-col gap-2 border-b border-surface-rim px-4 py-3 last:border-b-0">
      <Txt as="h3" variant="caption" tone="muted">
        {label}
      </Txt>
      {children}
    </section>
  );
}
