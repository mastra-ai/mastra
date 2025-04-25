import clsx from 'clsx';
import { useRef, useState } from 'react';
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
import { useTraceDuration } from './Trace.context';

export interface SpanProps {
  children: React.ReactNode;
  durationMs: number;
  variant: 'tool' | 'agent' | 'workflow' | 'memory' | 'rag' | 'storage' | 'eval' | 'other';
  tokenCount?: number;
  spans?: React.ReactNode;
  isRoot?: boolean;
  onClick?: () => void;
}

const iconMap = {
  tool: ToolsIcon,
  agent: AgentIcon,
  workflow: WorkflowIcon,
  memory: MemoryIcon,
  rag: TraceIcon,
  storage: DbIcon,
  eval: ScoreIcon,
  other: TraceIcon,
};

const variantClasses = {
  tool: 'text-[#ECB047]',
  agent: 'text-accent1',
  workflow: 'text-accent3',
  memory: 'text-accent2',
  rag: 'text-accent2',
  storage: 'text-accent2',
  eval: 'text-accent4',
  other: 'text-icon6',
};

export const Span = ({ children, durationMs, variant, tokenCount, spans, isRoot, onClick }: SpanProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const traceDuration = useTraceDuration();
  const VariantIcon = iconMap[variant];
  const variantClass = variantClasses[variant];

  const canExpand = React.Children.count(spans) > 0;

  const progressPercent = (durationMs / traceDuration) * 100;

  const TextEl = onClick ? 'button' : 'div';

  return (
    <li>
      <div className="grid grid-cols-2 items-center gap-2">
        <div className="flex h-8 items-center gap-1">
          {canExpand ? (
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse span' : 'Expand span'}
              aria-expanded={isExpanded}
              className="text-icon3 flex h-4 w-4"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Icon>
                <ChevronIcon className={clsx('transition-transform', { 'rotate-180': isExpanded })} />
              </Icon>
            </button>
          ) : (
            <div aria-hidden className="h-full w-4">
              {!isRoot && <div className="bg-surface4 ml-[7px] h-full w-px rounded-full" />}
            </div>
          )}

          <TextEl className="flex items-center gap-2" onClick={onClick}>
            <div className={clsx('bg-surface4 flex items-center justify-center rounded-md p-[3px]', variantClass)}>
              <Icon>
                <VariantIcon />
              </Icon>
            </div>
            <Txt variant="ui-md" className="text-icon6">
              {children}
            </Txt>
          </TextEl>
        </div>

        <Time
          durationMs={durationMs}
          tokenCount={tokenCount}
          variant={variant === 'agent' ? 'agent' : undefined}
          progressPercent={progressPercent}
        />
      </div>

      {isExpanded && spans && <div className="ml-4">{spans}</div>}
    </li>
  );
};
