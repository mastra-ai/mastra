import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function SettingsCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-border1 bg-surface3 divide-border1 divide-y rounded-xl border', className)}>
      {children}
    </div>
  );
}

export function SettingsRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Txt as="span" variant="ui-md" className="text-icon5">
          {label}
        </Txt>
        {hint && <div className="text-ui-sm text-icon3 flex flex-col gap-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
