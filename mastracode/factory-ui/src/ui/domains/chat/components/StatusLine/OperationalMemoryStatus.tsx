import type { AgentControllerOMProgress } from '@mastra/client-js';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { formatCompactTokens, TokenBudget, TokenBudgetDetail } from '@mastra/playground-ui/components/TokenBudget';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Brain, MessageSquare } from 'lucide-react';

import { useChatRuntime } from '../../context/useChatRuntime';
import type { OMWork } from '../../services/runtime';
import { omWork } from '../../services/runtime';

const messageLabel: Record<OMWork, string> = {
  idle: 'Message window until next observation',
  background: 'Saving the message window to memory in the background',
  blocking: 'Saving the message window to memory',
};

const observationLabel: Record<OMWork, string> = {
  idle: 'Observations accumulated until next reflection',
  background: 'Consolidating observations in the background',
  blocking: 'Consolidating observations',
};

/** The event stream carries the buffered passes; the session-state route carries them already flattened. */
function messageRemoval(om: AgentControllerOMProgress) {
  return Math.max(0, om.buffered?.observations.projectedMessageRemoval ?? om.projectedMessageRemoval ?? 0);
}

function reflectionSavings(om: AgentControllerOMProgress) {
  const reflection = om.buffered?.reflection;
  if (!reflection) return Math.max(0, om.projectedReflectionSavings ?? 0);
  return Math.max(0, reflection.inputObservationTokens - reflection.observationTokens);
}

function reading(tokens: number, threshold: number) {
  return `${formatCompactTokens(tokens)} of ${formatCompactTokens(threshold)}k`;
}

/**
 * Observational-memory budgets: the message window until the next observation
 * and the observations accumulated until the next reflection. Each ring shows
 * how full its budget is, and shimmers while memory works on it.
 */
export function OperationalMemoryStatus() {
  const runtime = useChatRuntime();
  const om = runtime.omProgress;
  const work = omWork(runtime);
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;

  if (!showMsg && !showMem) return null;

  const messageTone = work.messages === 'blocking' ? 'warning' : 'messages';
  const observationTone = work.observations === 'blocking' ? 'warning' : 'memory';
  /* A button hides its subtree from assistive tech, so the rings' own readings have to be spoken here. */
  const spoken = [
    showMsg && `messages ${reading(om.pendingTokens, om.threshold)}`,
    showMem && `observations ${reading(om.observationTokens, om.reflectionThreshold)}`,
  ].filter(Boolean);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Memory budgets: ${spoken.join(', ')}`}
        className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'gap-3')}
      >
        {showMsg && (
          <TokenBudget
            label={messageLabel[work.messages]}
            threshold={om.threshold}
            tokens={om.pendingTokens}
            tone={messageTone}
            working={work.messages !== 'idle'}
          />
        )}
        {showMem && (
          <TokenBudget
            label={observationLabel[work.observations]}
            threshold={om.reflectionThreshold}
            tokens={om.observationTokens}
            tone={observationTone}
            working={work.observations !== 'idle'}
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex flex-col gap-3.5" side="top">
        {showMsg && (
          <TokenBudgetDetail
            description="Read into memory once full"
            icon={<MessageSquare />}
            label="Messages"
            projected={messageRemoval(om)}
            threshold={om.threshold}
            tokens={om.pendingTokens}
            tone={messageTone}
          />
        )}
        {showMem && (
          <TokenBudgetDetail
            description="Consolidated into a reflection once full"
            icon={<Brain />}
            label="Observations"
            projected={reflectionSavings(om)}
            threshold={om.reflectionThreshold}
            tokens={om.observationTokens}
            tone={observationTone}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
