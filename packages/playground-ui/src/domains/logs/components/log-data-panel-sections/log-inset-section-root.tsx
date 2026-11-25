import { useId } from 'react';
import type { ReactNode } from 'react';
import { CardInset } from '@/ds/components/Card';
import { DataPanel } from '@/ds/components/DataPanel';

export function LogInsetSectionRoot({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className="grid gap-2" aria-labelledby={titleId}>
      <DataPanel.SectionHeading>
        <span id={titleId}>{title}</span>
      </DataPanel.SectionHeading>
      <CardInset as="dl">{children}</CardInset>
    </section>
  );
}
