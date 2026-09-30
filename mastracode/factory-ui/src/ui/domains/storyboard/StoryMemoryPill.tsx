import { Txt } from '@mastra/playground-ui/components/Txt';
import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { ProviderBrandIcon } from '../workspaces/components/ProviderBrandIcon';
import { providerOf } from './cast';
import { useStoryboard } from './StoryboardProvider';
import { StorySettingsLink } from './StoryExplain';
import type { StoryState } from './storyState';

type MemorySlots = { badge?: ReactNode; detail?: ReactNode };

function MemoryModel({ model }: { model: string }) {
  const provider = providerOf(model);
  return (
    <>
      {provider && <ProviderBrandIcon provider={provider} />}
      <span className="text-foreground">{model}</span>
    </>
  );
}

function MemoryDetail({ state }: { state: StoryState }) {
  const { memory, sharedAccount } = state;
  return (
    <div className="border-border flex flex-col gap-1.5 border-t pt-3">
      <Txt as="p" variant="label" tone="ink">
        Observational memory
      </Txt>
      <Txt as="p" variant="meta" tone="muted" className="flex flex-wrap items-center gap-1">
        <MemoryModel model={memory.model} />
        <span>· {sharedAccount ? `billed to ${sharedAccount.label}` : 'no Factory account to bill'}</span>
      </Txt>
      {memory.broken ? (
        <>
          <Txt as="p" variant="meta" className="text-destructive-indicator">
            Memory model failing: threads that need memory are paused.
          </Txt>
          <StorySettingsLink anchor="memory">Fix the memory model</StorySettingsLink>
        </>
      ) : (
        <StorySettingsLink anchor="memory" />
      )}
    </div>
  );
}

export function useStoryMemorySlots(): MemorySlots {
  const storyboard = useStoryboard();
  if (!storyboard) return {};
  const { state } = storyboard;
  const provider = providerOf(state.memory.model);
  const badge = state.memory.broken ? (
    <TriangleAlert aria-label="Memory model failing" className="text-destructive-indicator size-3.5" />
  ) : (
    provider && <ProviderBrandIcon provider={provider} />
  );
  return { badge, detail: <MemoryDetail state={state} /> };
}
