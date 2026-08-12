import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { MessageSquareText } from 'lucide-react';
import type { ReactNode } from 'react';

import { useChatRuntime } from '../../context/useChatRuntime';
import type { OMWork } from '../../services/runtime';
import { omWork } from '../../services/runtime';

const statusBudget = 'inline-flex items-center whitespace-nowrap tabular-nums';
const budgetTrigger =
  'focus-visible:ring-accent1 text-icon2 mr-1 inline-flex shrink-0 items-center rounded-sm outline-hidden focus-visible:ring-2';

const messageTooltip: Record<OMWork, string> = {
  idle: 'Message window until next observation',
  background: 'Saving the message window to memory in the background — no pause when it fills',
  blocking: 'Saving the message window to memory',
};

const observationTooltip: Record<OMWork, string> = {
  idle: 'Observations accumulated until next reflection',
  background: 'Consolidating observations in the background — no pause when they fill',
  blocking: 'Consolidating observations',
};

function fmtTokensValue(n: number): string {
  if (n <= 0) return '0';
  const s = (n / 1000).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function fmtTokensThreshold(n: number): string {
  const s = (n / 1000).toFixed(1);
  return `${s.endsWith('.0') ? s.slice(0, -2) : s}k`;
}

function pctClass(percent: number): string {
  if (percent >= 90) return 'text-error';
  if (percent >= 75) return 'text-warning1';
  return 'text-icon3';
}

function Budget({
  lead,
  tooltip,
  work,
  percent,
  tokens,
  threshold,
  saving,
}: {
  lead: ReactNode;
  tooltip: string;
  work: OMWork;
  percent: number;
  tokens: number;
  threshold: number;
  saving: number;
}) {
  const Tokens = work === 'idle' ? 'span' : Shimmer;

  return (
    <span className={`${statusBudget} ${pctClass(percent)}`}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span aria-label={tooltip} className={budgetTrigger} tabIndex={0}>
              {lead}
            </span>
          }
        />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <Tokens>
        {fmtTokensValue(tokens)}/{fmtTokensThreshold(threshold)}
        {saving > 0 && <span className="text-icon2 italic"> ↓{fmtTokensThreshold(saving)}</span>}
      </Tokens>
    </span>
  );
}

/**
 * Observational-memory budgets: the message window until the next observation
 * and the observations accumulated until the next reflection. Each shimmers
 * while memory works on it.
 */
export function OperationalMemoryStatus() {
  const runtime = useChatRuntime();
  const om = runtime.omProgress;
  const work = omWork(runtime);
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;

  if (!showMsg && !showMem) return null;

  return (
    <>
      {showMsg && (
        <Budget
          lead={<MessageSquareText aria-hidden size={13} />}
          tooltip={messageTooltip[work.messages]}
          work={work.messages}
          percent={om.thresholdPercent}
          tokens={om.pendingTokens}
          threshold={om.threshold}
          saving={om.projectedMessageRemoval}
        />
      )}
      {showMem && (
        <Budget
          lead="mem"
          tooltip={observationTooltip[work.observations]}
          work={work.observations}
          percent={om.reflectionThresholdPercent}
          tokens={om.observationTokens}
          threshold={om.reflectionThreshold}
          saving={om.projectedReflectionSavings}
        />
      )}
    </>
  );
}
