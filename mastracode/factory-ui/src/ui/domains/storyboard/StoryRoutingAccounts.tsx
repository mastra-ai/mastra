import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { providerDisplayName } from '../settings/components/provider-display-name';
import { PERSONA_IDS, PLANS, actorName } from './cast';
import type { PersonaId, Plan, PlanUsage } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { PolicyBlock } from './StorySettingControls';
import { StoryProviderPicker } from './StoryProviderPicker';
import { settingsAnchorId } from './storyLinks';
import { factoryKeys, ownPlansAllowed } from './storyState';
import type { StoryState } from './storyState';

const DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const KIND_LABELS: Record<Plan['kind'], string> = { subscription: 'Subscription', 'api-key': 'API key' };

function usageLine(usage: PlanUsage): { percent: number; label: string } {
  if (usage.kind === 'window') return { percent: usage.percent, label: `${usage.percent}% of plan window used` };
  const percent = Math.round((usage.spent / usage.budget) * 100);
  return { percent, label: `${DOLLARS.format(usage.spent)} of ${DOLLARS.format(usage.budget)} this month` };
}

function UsageBar({ usage }: { usage: PlanUsage }) {
  const { percent, label } = usageLine(usage);
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'flex h-1.5 w-28 overflow-hidden rounded-full bg-current/15',
          percent >= 80 ? 'text-warning-indicator' : 'text-foreground',
        )}
      >
        <span className="bg-current" style={{ width: `${Math.min(100, percent)}%` }} />
      </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}

function AccountRow({
  plan,
  owner,
  missing,
  note,
  action,
}: {
  plan: Plan | null;
  owner: string;
  missing: string;
  note?: string;
  action?: ReactNode;
}) {
  if (plan === null)
    return (
      <SettingsRow label={missing}>
        <div className="flex items-center gap-2">
          <Badge size="sm" variant="neutral">
            Not connected
          </Badge>
          {action}
        </div>
      </SettingsRow>
    );
  const disconnected = plan.disconnected === true;
  return (
    <SettingsRow
      label={
        <span className="inline-flex items-center gap-2">
          <ProviderLogo providerId={plan.provider} size={16} />
          {plan.label} · {providerDisplayName(plan.provider)}
        </span>
      }
      tone={disconnected ? 'destructive' : 'default'}
      description={
        <>
          <span>{[KIND_LABELS[plan.kind], owner, note].filter(Boolean).join(' · ')}</span>
          {disconnected ? <span>Paused until reconnected</span> : plan.usage && <UsageBar usage={plan.usage} />}
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Badge size="sm" variant={disconnected ? 'destructive' : 'success'}>
          {disconnected ? 'Disconnected' : 'Connected'}
        </Badge>
        {action}
      </div>
    </SettingsRow>
  );
}

function MyPlanAction({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const plan = state.memberPlans[state.viewer];
  const setPlan = (next: Plan) => patch({ memberPlans: { ...state.memberPlans, [state.viewer]: next } });
  if (plan === null)
    return (
      <Button size="sm" onClick={() => setPlan(PLANS.claudeMax)}>
        Connect
      </Button>
    );
  const disconnected = plan.disconnected === true;
  return (
    <Button
      size="sm"
      variant={disconnected ? 'primary' : 'ghost'}
      onClick={() => setPlan({ ...plan, disconnected: !disconnected })}
    >
      {disconnected ? 'Reconnect' : 'Disconnect'}
    </Button>
  );
}

function addFactoryKey(state: StoryState, key: Plan): Partial<StoryState> {
  return state.sharedAccount === null ? { sharedAccount: key } : { providerKeys: [...state.providerKeys, key] };
}

function removeFactoryKey(state: StoryState, key: Plan): Partial<StoryState> {
  if (key !== state.sharedAccount) return { providerKeys: state.providerKeys.filter(candidate => candidate !== key) };
  return { sharedAccount: state.providerKeys[0] ?? null, providerKeys: state.providerKeys.slice(1) };
}

function FactoryKeyRows({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const keys = factoryKeys(state);
  return (
    <>
      {keys.map(key => (
        <AccountRow
          key={key.label}
          plan={key}
          owner={key.kind === 'subscription' ? 'Your plan, used by the Factory' : 'Factory'}
          missing={key.label}
          note={key === state.sharedAccount && keys.length > 1 ? 'Default' : undefined}
          action={
            <Button size="sm" variant="ghost" onClick={() => patch(removeFactoryKey(state, key))}>
              Disconnect
            </Button>
          }
        />
      ))}
      <SettingsRow label={keys.length === 0 ? 'No account yet: cards wait' : 'Add a provider'}>
        <div className="flex flex-wrap justify-end gap-2">
          <StoryProviderPicker kind="api-key" state={state} onPick={key => patch(addFactoryKey(state, key))} />
          {keys.length === 0 && (
            <StoryProviderPicker kind="subscription" state={state} onPick={plan => patch(addFactoryKey(state, plan))} />
          )}
        </div>
      </SettingsRow>
    </>
  );
}

function ownerName(persona: PersonaId, viewer: PersonaId): string {
  return persona === viewer ? 'You' : actorName(persona);
}

export function FactoryAccounts({ storyboard }: { storyboard: Storyboard }) {
  const { state } = storyboard;
  return (
    <>
      <PolicyBlock
        id={settingsAnchorId('factory-work')}
        title="Factory accounts"
        hint="Pay for board work and Factory sessions."
      >
        <FactoryKeyRows storyboard={storyboard} />
      </PolicyBlock>
      {ownPlansAllowed(state) && (
        <PolicyBlock title="Members' plans" hint="Pay for their owner's sessions and cards.">
          {PERSONA_IDS.map(persona => (
            <AccountRow
              key={persona}
              plan={state.memberPlans[persona]}
              owner={ownerName(persona, state.viewer)}
              missing={`${ownerName(persona, state.viewer)} · no plan`}
              action={persona === state.viewer ? <MyPlanAction storyboard={storyboard} /> : undefined}
            />
          ))}
        </PolicyBlock>
      )}
    </>
  );
}

export function PersonalAccounts({ storyboard }: { storyboard: Storyboard }) {
  const { state } = storyboard;
  const ownPlans = ownPlansAllowed(state);
  const keys = factoryKeys(state);
  return (
    <SettingsContainer>
      {ownPlans && (
        <AccountRow
          plan={state.memberPlans[state.viewer]}
          owner="You"
          missing="You have no plan"
          action={<MyPlanAction storyboard={storyboard} />}
        />
      )}
      {keys.map(key => (
        <AccountRow
          key={key.label}
          plan={key}
          owner="Factory"
          missing={key.label}
          note={state.allowed.companyKeys ? 'Usable in your sessions' : 'Factory work only'}
        />
      ))}
      {!ownPlans && (
        <Txt as="p" variant="meta" tone="muted" className="px-4 py-2">
          {keys.length > 0
            ? 'Your Factory runs on company keys only: nothing to connect here. Pick any of their models below.'
            : 'Your Factory runs on one account and none is connected yet. An admin adds it in Factory settings.'}
        </Txt>
      )}
    </SettingsContainer>
  );
}
