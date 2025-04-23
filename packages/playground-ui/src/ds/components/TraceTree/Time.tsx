import clsx from 'clsx';
import React from 'react';

import { Txt } from '../Txt';

export interface TimeProps {
  durationMs: number;
  tokenCount?: number;
  variant?: 'agent';
  progressPercent: number;
}

const variantClasses = {
  agent: 'bg-accent1',
};

export const Time = ({ durationMs, tokenCount, variant, progressPercent }: TimeProps) => {
  const variantClass = variant ? variantClasses[variant] : 'bg-accent3';

  return (
    <div>
      <div className="bg-surface4 relative h-[6px] w-full rounded-full p-px">
        <div className={clsx('absolute h-1 rounded-full', variantClass)} style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="flex items-center gap-4 pt-0.5">
        <Txt variant="ui-sm" className="text-icon2 font-medium">
          {durationMs}ms
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
