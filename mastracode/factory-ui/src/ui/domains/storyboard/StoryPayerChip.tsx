import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Building2 } from 'lucide-react';

import { actorName, possessive } from './cast';
import type { Actor } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { billedTo, blockedShort, capitalize, slackReply } from './storyBillingCopy';
import { payerReason } from './StoryCardExplainers';
import { composerPayer, payerRuleAnchor } from './storyComposer';
import type { ComposerPayer } from './storyComposer';
import { StoryExplain, StorySettingsLink } from './StoryExplain';
import { blockedFix } from './storyLinks';
import { composerGate, moveToFactory } from './storyState';
import type { CardFacts, StoryState } from './storyState';

export function ActorGlyph({ actor }: { actor: Actor }) {
  if (actor === 'factory') return <Building2 aria-hidden className="size-3.5 shrink-0" />;
  return (
    <span aria-hidden className="flex shrink-0 [&>div]:size-4 [&>div>*]:text-[9px]">
      <Avatar name={actorName(actor)} size="sm" />
    </span>
  );
}

function chipLabel(state: StoryState, payer: ComposerPayer): string {
  if (payer.kind === 'blocked') return capitalize(blockedShort(payer.billing, state));
  return payer.payer === 'factory' ? 'Factory' : capitalize(billedTo(state, payer.payer));
}

function PayerActions({ storyboard, card, payer }: { storyboard: Storyboard; card: CardFacts; payer: ComposerPayer }) {
  const { state, patchCard } = storyboard;
  if (payer.kind === 'blocked') {
    const fix = blockedFix(payer.billing.reason, payer.billing.payer, state.viewer);
    return <StorySettingsLink anchor={fix.anchor}>{fix.label}</StorySettingsLink>;
  }
  const toFactory = card.origin === 'slack-dm' && card.owner === state.viewer ? moveToFactory(state, card) : null;
  return (
    <>
      {toFactory && (
        <Button size="sm" variant="ghost" onClick={() => patchCard(0, toFactory)}>
          Move to Factory
        </Button>
      )}
      <StorySettingsLink anchor={payerRuleAnchor(card)} />
    </>
  );
}

function PayerDetail({ state, card, payer }: { state: StoryState; card: CardFacts; payer: ComposerPayer }) {
  if (payer.kind === 'blocked')
    return <span>Paused: {blockedShort(payer.billing, state)}. Nothing runs until that is fixed.</span>;
  const gate = composerGate(state, card);
  const fromSlack = card.origin === 'slack-channel' || card.origin === 'slack-dm';
  return (
    <>
      <span className="text-foreground">{capitalize(billedTo(state, payer.payer))} pays.</span>
      {gate.kind === 'steer' ? (
        <span>
          {possessive(gate.owner)} session keeps the plan it started on. Your messages steer it; they never change who
          pays. Taking ownership does.
        </span>
      ) : (
        <span>{payerReason(state, card)}</span>
      )}
      {fromSlack && <span>Bot’s first reply in Slack: {slackReply(state, card)}</span>}
    </>
  );
}

export function StoryPayerChip({ storyboard, card }: { storyboard: Storyboard; card: CardFacts }) {
  const { state } = storyboard;
  const payer = composerPayer(state, card);
  const label = chipLabel(state, payer);
  return (
    <StoryExplain
      title="Who pays"
      trigger={
        <button
          type="button"
          aria-label={`Who pays: ${label}`}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            payer.kind === 'blocked' && 'text-destructive-indicator',
          )}
        >
          <ActorGlyph actor={payer.kind === 'blocked' ? payer.billing.payer : payer.payer} />
          <span className="max-w-40 truncate">{label}</span>
        </button>
      }
      actions={<PayerActions storyboard={storyboard} card={card} payer={payer} />}
    >
      <PayerDetail state={state} card={card} payer={payer} />
    </StoryExplain>
  );
}
