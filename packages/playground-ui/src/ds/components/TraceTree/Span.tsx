import clsx from 'clsx';
import { useState } from 'react';
import React from 'react';

import { AgentIcon } from '../../icons/AgentIcon';
import { ChevronIcon } from '../../icons/ChevronIcon';
import { DbIcon } from '../../icons/DbIcon';
import { Icon } from '../../icons/Icon';
import { MemoryIcon } from '../../icons/MemoryIcon';
import { ScoreIcon } from '../../icons/ScoreIcon';
import { ToolsIcon } from '../../icons/ToolsIcon';
import { TraceIcon } from '../../icons/TraceIcon';
import { WorkflowIcon } from '../../icons/WorkflowIcon';
import { Txt } from '../Txt';

import { Time } from './Time';

export interface SpanProps {
  children: React.ReactNode;
  durationMs: number;
  variant: 'tool' | 'agent' | 'workflow' | 'memory' | 'rag' | 'storage' | 'eval' | 'other';
  tokenCount?: number;
  spans?: React.ReactNode;
  isRoot?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  offsetMs: number;
  totalDurationMs: number;
}

export const spanIconMap = {
  tool: ToolsIcon,
  agent: AgentIcon,
  workflow: WorkflowIcon,
  memory: MemoryIcon,
  rag: TraceIcon,
  storage: DbIcon,
  eval: ScoreIcon,
  other: TraceIcon,
};

export const spanVariantClasses = {
  tool: 'text-[#ECB047]',
  agent: 'text-accent1',
  workflow: 'text-accent3',
  memory: 'text-accent2',
  rag: 'text-accent2',
  storage: 'text-accent2',
  eval: 'text-accent4',
  other: 'text-icon6',
};

export const Span = ({
  children,
  durationMs,
  variant,
  tokenCount,
  spans,
  isRoot,
  onClick,
  isActive,
  offsetMs,
  totalDurationMs,
}: SpanProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const VariantIcon = spanIconMap[variant];
  const variantClass = spanVariantClasses[variant];

  const progressPercent = (durationMs / totalDurationMs) * 100;
  const offsetPercent = (offsetMs / totalDurationMs) * 100;

  const TextEl = onClick ? 'button' : 'div';

  return (
    <li>
      <div className={clsx('flex justify-between items-center gap-2 rounded-md pl-2', isActive && 'bg-surface4')}>
        <div className="flex h-8 items-center gap-1 min-w-0">
          {spans ? (
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse span' : 'Expand span'}
              aria-expanded={isExpanded}
              className="text-icon3 flex h-4 w-4"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Icon>
                <ChevronIcon className={clsx('transition-transform -rotate-90', { 'rotate-0': isExpanded })} />
              </Icon>
            </button>
          ) : (
            <div aria-hidden className="h-full w-4">
              {!isRoot && <div className="ml-[7px] h-full w-px rounded-full" />}
            </div>
          )}

          <TextEl className="flex items-center gap-2 min-w-0" onClick={onClick}>
            <div className={clsx('bg-surface4 flex items-center justify-center rounded-md p-[3px]', variantClass)}>
              <Icon>
                <VariantIcon />
              </Icon>
            </div>
            <Txt variant="ui-md" className="text-icon6 truncate">
              {children}
            </Txt>
          </TextEl>
        </div>

        <Time
          durationMs={durationMs}
          tokenCount={tokenCount}
          variant={variant === 'agent' ? 'agent' : undefined}
          progressPercent={progressPercent}
          offsetPercent={offsetPercent}
        />
      </div>

      {isExpanded && spans && <div className="ml-4">{spans}</div>}
    </li>
  );
};
