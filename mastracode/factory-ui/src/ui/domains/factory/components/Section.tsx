import type { ReactNode } from 'react';

import { STAT_LABEL } from './Stat';

/** A run of figures under one micro-caps name — the name ranks it, nothing frames it. */
export function Section({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-6">
      <div className="border-border1 flex items-center justify-between gap-4 border-b pb-2.5">
        <h2 className={`m-0 ${STAT_LABEL}`}>{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
