import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

export function SettingsCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-border1 bg-surface3 divide-border1 divide-y rounded-xl border', className)}>
      {children}
    </div>
  );
}

function RowInfo({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="More information"
              className="text-icon3 hover:text-icon5 flex cursor-pointer items-center"
            >
              <Info size={12} />
            </button>
          }
        />
        <TooltipContent side="top" className="max-w-72">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SettingsRow({
  label,
  hint,
  icon,
  info,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  info?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div data-slot="settings-row" className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          {icon && <span className="text-icon3 flex shrink-0 items-center">{icon}</span>}
          <Txt as="span" variant="ui-md" className="text-icon5">
            {label}
          </Txt>
          {info && <RowInfo>{info}</RowInfo>}
        </span>
        {hint && <div className="text-ui-sm text-icon3 flex flex-col gap-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
