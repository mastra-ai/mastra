import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowRightLeft, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { ProviderBrandIcon } from '../workspaces/components/ProviderBrandIcon';
import { actorName } from './cast';
import { useStoryboard } from './StoryboardProvider';
import { capitalize, thinkingLabel, whose } from './storyBillingCopy';
import { ActorGlyph } from './StoryPayerChip';
import type { Provenance, ProvenanceSwitch } from './storyProvenance';
import type { StoryState } from './storyState';
import { storyReplyProvenance } from './storyTranscript';

function payerName(state: StoryState, provenance: Provenance): string {
  if (provenance.payer === 'factory') return provenance.plan.label;
  return `${capitalize(whose(provenance.payer, state.viewer))} ${provenance.plan.label}`;
}

function RanOnLine({ state, provenance }: { state: StoryState; provenance: Provenance }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Txt
            as="span"
            variant="meta"
            tone="faint"
            tabIndex={0}
            className="flex w-fit cursor-help items-center gap-1.5 [&_svg]:opacity-70"
          >
            <ProviderBrandIcon provider={provenance.plan.provider} />
            {provenance.model}
            <span aria-hidden>·</span>
            <ActorGlyph actor={provenance.payer} />
            {payerName(state, provenance)}
          </Txt>
        }
      />
      <TooltipContent side="bottom">
        {provenance.model} · {thinkingLabel(provenance.thinking)} thinking · {provenance.plan.label}
      </TooltipContent>
    </Tooltip>
  );
}

function SwitchMarker({ state, change }: { state: StoryState; change: ProvenanceSwitch }) {
  const Icon = change.takenBy ? UserRoundCheck : ArrowRightLeft;
  return (
    <div role="note" className="flex items-center gap-3 py-2">
      <span aria-hidden className="bg-border h-px flex-1" />
      <Txt as="span" variant="meta" tone="muted" className="flex items-center gap-1.5">
        <Icon aria-hidden className="size-3" />
        {change.takenBy ? `${actorName(change.takenBy)} took ownership · now` : 'Switched to'}
        <ActorGlyph actor={change.to.payer} />
        {payerName(state, change.to)} · {change.to.model}
      </Txt>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}

export function useStoryReplyRanOn(replyId: string | undefined): ReactNode {
  const storyboard = useStoryboard();
  const provenance = storyboard && replyId ? storyReplyProvenance(storyboard.state, replyId) : null;
  return storyboard && provenance ? <RanOnLine state={storyboard.state} provenance={provenance.ranOn} /> : null;
}

export function StoryReplyProvenance({ replyId, settled }: { replyId: string; settled: boolean }) {
  const storyboard = useStoryboard();
  if (!storyboard) return null;
  const { state } = storyboard;
  const provenance = storyReplyProvenance(state, replyId);
  if (!provenance) return null;
  return (
    <>
      {settled && <RanOnLine state={state} provenance={provenance.ranOn} />}
      {provenance.switchedTo && <SwitchMarker state={state} change={provenance.switchedTo} />}
    </>
  );
}
