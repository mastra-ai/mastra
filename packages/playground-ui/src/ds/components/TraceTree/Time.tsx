import clsx from 'clsx';

import { Txt } from '../Txt';
import { toSigFigs } from '@/lib/number';

export interface TimeProps {
  durationMs: number;
  tokenCount?: number;
  variant?: 'agent';
  progressPercent: number;
  offsetPercent: number;
}

const variantClasses = {
  agent: 'bg-accent1',
};

export const Time = ({ durationMs, tokenCount, variant, progressPercent, offsetPercent }: TimeProps) => {
  const variantClass = variant ? variantClasses[variant] : 'bg-accent3';
  const percent = Math.min(100, progressPercent);

  return (
    <div className="w-[80px] xl:w-[166px] shrink-0">
      <div className="bg-surface4 relative h-[6px] w-full rounded-full p-px overflow-hidden">
        <div
          className={clsx('absolute h-1 rounded-full', variantClass)}
          style={{ width: `${percent}%`, left: `${offsetPercent}%` }}
        />
      </div>
      <div className="flex items-center gap-4 pt-0.5">
        <Txt variant="ui-sm" className="text-icon2 font-medium">
          {toSigFigs(durationMs, 3)}ms
        </Txt>
        {tokenCount && (
          <Txt variant="ui-sm" className="text-icon2 font-medium">
            {tokenCount}t
          </Txt>
        )}
      </div>
    </div>
  );
};
