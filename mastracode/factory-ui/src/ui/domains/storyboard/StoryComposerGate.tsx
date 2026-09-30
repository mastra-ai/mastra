import { Button } from '@mastra/playground-ui/components/Button';
import { UserRoundCheck, Users } from 'lucide-react';
import { useState } from 'react';

import { possessive } from './cast';
import type { Actor, PersonaId } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { billedTo } from './storyBillingCopy';
import { steeringLine, takeOwnershipEffects } from './storyComposer';
import { StoryComposerTray } from './StoryComposerTray';
import { ActorGlyph } from './StoryPayerChip';
import { takeOwnership } from './storyState';
import type { CardFacts } from './storyState';

export function StorySteerHint({ storyboard, owner }: { storyboard: Storyboard; owner: PersonaId }) {
  const { state, patch } = storyboard;
  return (
    <StoryComposerTray
      edge="top"
      label="Steering someone else’s session"
      icon={<Users />}
      actions={
        <Button size="sm" variant="ghost" onClick={() => patch({ steerHintSeen: true })}>
          Got it
        </Button>
      }
    >
      First time here: this is {possessive(owner)} session. Your messages steer the running agent on the plan it started
      on, never on {billedTo(state, state.viewer)}. To make it yours, take ownership.
    </StoryComposerTray>
  );
}

function TakeOwnershipConfirm({
  storyboard,
  card,
  cancel,
}: {
  storyboard: Storyboard;
  card: CardFacts;
  cancel: () => void;
}) {
  const { state, patchCard } = storyboard;
  return (
    <StoryComposerTray
      edge="bottom"
      tone="warning"
      label="Take ownership"
      icon={<UserRoundCheck />}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => patchCard(0, takeOwnership(state, card))}>
            Take ownership
          </Button>
        </>
      }
    >
      Take {possessive(card.owner)} session? {takeOwnershipEffects(state, card).join(' ')}
    </StoryComposerTray>
  );
}

export function StorySteerFooter({
  storyboard,
  card,
  owner,
  payer,
}: {
  storyboard: Storyboard;
  card: CardFacts;
  owner: PersonaId;
  payer: Actor;
}) {
  const [confirmingFor, setConfirmingFor] = useState<CardFacts | null>(null);
  if (confirmingFor === card)
    return <TakeOwnershipConfirm storyboard={storyboard} card={card} cancel={() => setConfirmingFor(null)} />;
  return (
    <StoryComposerTray
      edge="bottom"
      label="Whose session this is"
      icon={<ActorGlyph actor={payer} />}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setConfirmingFor(card)}>
          Take ownership
        </Button>
      }
    >
      {steeringLine(storyboard.state, owner, payer)}
    </StoryComposerTray>
  );
}
