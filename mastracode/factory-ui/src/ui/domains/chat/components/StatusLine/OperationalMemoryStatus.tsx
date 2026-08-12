import { TokenBudget, formatCompactTokens } from '@mastra/playground-ui/components/TokenBudget';

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

function savingHint(tokens: number): string | undefined {
  return tokens > 0 ? `↓${formatCompactTokens(tokens)}k` : undefined;
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

  return (
    <>
      {showMsg && (
        <TokenBudget
          hint={savingHint(om.projectedMessageRemoval)}
          label={messageLabel[work.messages]}
          threshold={om.threshold}
          tokens={om.pendingTokens}
          tone={work.messages === 'blocking' ? 'warning' : 'messages'}
          working={work.messages !== 'idle'}
        />
      )}
      {showMem && (
        <TokenBudget
          hint={savingHint(om.projectedReflectionSavings)}
          label={observationLabel[work.observations]}
          threshold={om.reflectionThreshold}
          tokens={om.observationTokens}
          tone={work.observations === 'blocking' ? 'warning' : 'memory'}
          working={work.observations !== 'idle'}
        />
      )}
    </>
  );
}
