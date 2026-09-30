import { Button } from '@mastra/playground-ui/components/Button';
import { CirclePause, ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { actorName } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { capitalize, whose } from './storyBillingCopy';
import type { BlockedBilling } from './storyComposer';
import { StoryComposerTray, StoryFixPill } from './StoryComposerTray';
import { StorySettingsLink } from './StoryExplain';
import { blockedFix } from './storyLinks';
import type { StoryFix } from './storyLinks';
import { moveToMyPlan } from './storyState';
import type { CardFacts } from './storyState';

function BlockedTray({
  restricted = false,
  fix,
  message,
  inPlaceFix,
}: {
  restricted?: boolean;
  fix: StoryFix;
  message: ReactNode;
  inPlaceFix?: { label: string; apply: () => void; settingsToo: boolean };
}) {
  return (
    <StoryComposerTray
      edge="top"
      tone={restricted ? 'warning' : 'destructive'}
      label={restricted ? 'Not allowed here' : 'Paused'}
      icon={restricted ? <ShieldOff /> : <CirclePause />}
      link={inPlaceFix?.settingsToo && <StorySettingsLink anchor={fix.anchor}>{fix.label}</StorySettingsLink>}
      actions={
        inPlaceFix ? (
          <Button size="sm" variant="primary" onClick={inPlaceFix.apply}>
            {inPlaceFix.label}
          </Button>
        ) : (
          <StoryFixPill fix={fix} />
        )
      }
    >
      {message}
    </StoryComposerTray>
  );
}

export function StoryComposerBlocked({
  storyboard,
  card,
  billing,
}: {
  storyboard: Storyboard;
  card: CardFacts;
  billing: BlockedBilling;
}) {
  const { state, patch, patchCard } = storyboard;
  const { payer } = billing;
  const fix = blockedFix(billing.reason, payer, state.viewer);

  if (billing.reason === 'memory') {
    const retry = () => patch({ memory: { ...state.memory, broken: false } });
    return (
      <BlockedTray
        fix={fix}
        message={`Paused · memory model ${state.memory.model} is failing`}
        inPlaceFix={{ label: 'Retry', apply: retry, settingsToo: true }}
      />
    );
  }

  if (billing.reason === 'shared-account') {
    return <BlockedTray fix={fix} message="Paused · no Factory account, so Factory work has nobody to bill" />;
  }

  if (payer === 'factory') {
    const toMine = moveToMyPlan(state, card);
    return (
      <BlockedTray
        restricted
        fix={fix}
        message="Company keys are kept for Factory work · this personal session can’t use them"
        inPlaceFix={
          toMine ? { label: 'Move to my plan', apply: () => patchCard(0, toMine), settingsToo: true } : undefined
        }
      />
    );
  }

  const plan = state.memberPlans[payer];
  const mine = payer === state.viewer;

  if (billing.reason === 'reconnect' && plan) {
    const reconnect = () => patch({ memberPlans: { ...state.memberPlans, [payer]: { ...plan, disconnected: false } } });
    return (
      <BlockedTray
        fix={fix}
        message={`Paused · ${mine ? 'reconnect your' : `${actorName(payer)} must reconnect`} ${plan.label} · no company fallback`}
        inPlaceFix={mine ? { label: 'Reconnect', apply: reconnect, settingsToo: false } : undefined}
      />
    );
  }

  if (billing.reason === 'restricted' && plan) {
    const kind = plan.kind === 'subscription' ? 'subscriptions' : 'personal API keys';
    return (
      <BlockedTray
        restricted
        fix={fix}
        message={`${capitalize(`${whose(payer, state.viewer)} ${plan.label}`)} can’t run here · the admin turned off ${kind}`}
      />
    );
  }

  return (
    <BlockedTray
      fix={fix}
      message={mine ? 'Paused · you have no plan connected' : `Paused · ${actorName(payer)} has no plan connected`}
    />
  );
}
