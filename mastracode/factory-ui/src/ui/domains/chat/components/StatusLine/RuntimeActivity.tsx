import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Brain } from 'lucide-react';

import { useChatRuntime } from '../../context/useChatRuntime';
import type { OMWorkByBudget } from '../../services/runtime';
import { omWork } from '../../services/runtime';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

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
        <span className={statusItem}>
          <Brain size={13} /> <Shimmer>{label}</Shimmer>
        </span>
      )}
      {runtime.tokensPerSec > 0 && <span className={statusItem}>{runtime.tokensPerSec} tok/s</span>}
    </>
  );
}
