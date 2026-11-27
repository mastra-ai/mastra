import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export function LogInsetRow({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="shrink-0">
        <Txt as="span" variant="body-sm" tone="muted">
          {label}
        </Txt>
      </dt>
      <dd className="ml-auto min-w-0 text-right wrap-anywhere">
        <Txt as="span" variant="body-sm" tone="ink" font={mono ? 'mono' : undefined}>
          {children}
        </Txt>
      </dd>
    </div>
  );
}
