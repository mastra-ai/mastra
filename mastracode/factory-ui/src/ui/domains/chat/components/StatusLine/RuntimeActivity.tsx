import { agentGlyph } from '@mastra/playground-ui/components/AgentIndicator';
import { Shimmer } from '@mastra/playground-ui/components/Shimmer';

import { useChatRuntime } from '../../context/useChatRuntime';
import type { OMWorkByBudget } from '../../services/om';
import { omWork } from '../../services/om';

const MemoryGlyph = agentGlyph('memory');

const statusItem = 'inline-flex items-center gap-1 text-muted-foreground [&_svg]:text-placeholder';

function holdingLabel({ messages, observations }: OMWorkByBudget): string | undefined {
  if (messages === 'blocking') return 'saving memory';
  if (observations === 'blocking') return 'consolidating memory';
  return undefined;
}

export function RuntimeActivity() {
  const runtime = useChatRuntime();
  const label = holdingLabel(omWork(runtime));

  return (
    <>
      {label && (
        <span className={statusItem}>
          <MemoryGlyph size={13} /> <Shimmer>{label}</Shimmer>
        </span>
      )}
      {runtime.tokensPerSec > 0 && <span className={statusItem}>{runtime.tokensPerSec} tok/s</span>}
    </>
  );
}
