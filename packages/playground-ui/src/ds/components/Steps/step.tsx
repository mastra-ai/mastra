import { CheckIcon } from 'lucide-react';
import { useContext } from 'react';
import type { ReactNode } from 'react';
import { StepsHeadingContext } from './steps-context';
import { Txt } from '@/ds/components/Txt';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type StepProps = {
  title: ReactNode;
  /** One or two lines under the title. */
  description?: ReactNode;
  /** Sits at the end of the title row: a docs link, a toggle. */
  action?: ReactNode;
  /** Swaps the number for a check. */
  done?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Step({ title, description, action, done, className, children }: StepProps) {
  const headingLevel = useContext(StepsHeadingContext);

  return (
    <li
      className={cn('group/step grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 [counter-increment:ds-step]', className)}
    >
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full',
            transitions.colors,
            done ? 'bg-success-indicator/18 text-success-indicator' : 'bg-fill text-foreground',
          )}
        >
          {done ? (
            <CheckIcon className="size-3.5" aria-label="Done" />
          ) : (
            <Txt as="span" variant="caption" className="font-medium before:content-[counter(ds-step)]" aria-hidden />
          )}
        </span>
        <span aria-hidden className="w-px flex-1 bg-border group-last/step:hidden" />
      </div>

      <div className="flex min-w-0 flex-col gap-3 pb-8 group-last/step:pb-0">
        <div className="flex flex-col gap-1">
          {/* As tall as the marker, so a one-line title centers on it. */}
          <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <Txt as={headingLevel === 2 ? 'h2' : 'h3'} variant="label" className="text-pretty">
              {title}
            </Txt>
            {action != null ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
          </div>
          {description != null ? (
            <Txt as="p" variant="body-sm" tone="muted" className="max-w-[70ch] text-pretty">
              {description}
            </Txt>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}
