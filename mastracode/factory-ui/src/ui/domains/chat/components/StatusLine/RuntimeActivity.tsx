import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { TokenRate } from '@mastra/playground-ui/components/TokenRate';
import { Brain } from 'lucide-react';

import { useChatRuntime } from '../../context/useChatRuntime';
import type { OMWorkByBudget } from '../../services/runtime';
import { omWork } from '../../services/runtime';

function holdingLabel({ messages, observations }: OMWorkByBudget): string | undefined {
  if (messages === 'blocking') return 'saving memory';
  if (observations === 'blocking') return 'consolidating memory';
  return undefined;
}

/** Memory work that holds the turn, and decode throughput. Background memory work shimmers on its budget instead. */
export function RuntimeActivity() {
  const runtime = useChatRuntime();
  const label = holdingLabel(omWork(runtime));

  return (
    <>
      {label && (
        <span className="text-icon3 [&_svg]:text-icon2 inline-flex items-center gap-1">
          <Brain size={13} /> <Shimmer>{label}</Shimmer>
        </span>
      )}
      <TokenRate className="text-icon3" history={runtime.tokensPerSecHistory} tokensPerSec={runtime.tokensPerSec} />
    </>
  );
}
