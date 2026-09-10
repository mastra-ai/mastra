import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { formatCompactTokens, TokenBudget, TokenBudgetDetail } from '@mastra/playground-ui/components/TokenBudget';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Brain, MessageSquare } from 'lucide-react';
import { useState } from 'react';

import { useAgentControllerOMRecord } from '../../../../../hooks/useAgentControllerOMRecord';
import { useOptionalChatSessionContext } from '../../context/useChatSessionContext';
import { useChatRuntime } from '../../context/useChatRuntime';
import { AGENT_CONTROLLER_ID } from '../../services/constants';
import type { OMWork } from '../../services/runtime';
import { omWork } from '../../services/runtime';
import { ObservationalMemoryContent } from './ObservationalMemoryContent';

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
  // The budget rings also render outside a mounted session, where there is no
  // record to read.
  const session = useOptionalChatSessionContext();
  const [open, setOpen] = useState(false);
  const om = runtime.omProgress;
  const work = omWork(runtime);
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;

  // Only read while the panel is open, and keep re-reading while memory works.
  const recordQuery = useAgentControllerOMRecord({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: session?.resourceId ?? '',
    scope: session?.projectPath,
    baseUrl: session?.baseUrl ?? '',
    enabled: open && Boolean(session?.resourceReady || (session?.resourceEnabled && session?.resourceId)),
    active: work.messages !== 'idle' || work.observations !== 'idle',
  });

  if (!showMsg && !showMem) return null;

  const messageTone = work.messages === 'blocking' ? 'warning' : 'messages';
  const observationTone = work.observations === 'blocking' ? 'warning' : 'memory';
  /* A button hides its subtree from assistive tech, so each ring's own label and reading have to be spoken here. */
  const spoken = [
    showMsg && `${messageLabel[work.messages]}, ${reading(om.pendingTokens, om.threshold)}`,
    showMem && `${observationLabel[work.observations]}, ${reading(om.observationTokens, om.reflectionThreshold)}`,
  ].filter(Boolean);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={`Memory budgets: ${spoken.join('. ')}`}
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
      <PopoverContent align="start" className="flex w-[32rem] max-w-[90vw] flex-col gap-3.5 p-0" side="top">
        <div className="flex flex-col gap-3.5 px-4 pt-4">
          {showMsg && (
            <TokenBudgetDetail
              description="Read into memory once full"
              icon={<MessageSquare />}
              label="Messages"
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
              threshold={om.reflectionThreshold}
              tokens={om.observationTokens}
              tone={observationTone}
            />
          )}
        </div>
        {session && (
          <div className="border-border1 max-h-80 min-h-0 overflow-y-auto border-t" data-testid="om-content">
            <ObservationalMemoryContent isLoading={recordQuery.isLoading} record={recordQuery.data} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
