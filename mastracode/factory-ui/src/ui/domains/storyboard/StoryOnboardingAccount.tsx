import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check, KeyRound, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { providerDisplayName } from '../settings/components/provider-display-name';
import type { Plan } from './cast';
import { providerOf } from './cast';
import { WORK_LANES } from './storyBoards';
import { StoryProviderPicker } from './StoryProviderPicker';
import type { Storyboard } from './StoryboardProvider';
import type { AllowedConnections, OnboardingFlow, StoryState } from './storyState';
import { COMPANY_KEYS_ONLY, EACH_OWNER_PAYS, factoryKeys, ownPlansAllowed } from './storyState';

type Payer = 'company' | 'owner';

type Tradeoff = { good: boolean; text: string };

const PAYERS: { value: Payer; icon: LucideIcon; title: string; detail: string; tradeoffs: Tradeoff[] }[] = [
  {
    value: 'company',
    icon: KeyRound,
    title: 'One account runs everything',
    detail: 'A company API key, or your own subscription if you’re on your own.',
    tradeoffs: [
      { good: true, text: 'Every lane can start on its own' },
      { good: true, text: 'Members connect nothing' },
    ],
  },
  {
    value: 'owner',
    icon: Users,
    title: 'Everyone brings their own plan',
    detail: 'Each card runs on its owner’s subscription or key.',
    tradeoffs: [
      { good: true, text: 'No shared key needed' },
      { good: false, text: 'Owner lanes can’t auto-start' },
    ],
  },
];

const PERSONAL_LABELS: { key: keyof AllowedConnections; label: string }[] = [
  { key: 'subscriptions', label: 'subscriptions' },
  { key: 'personalKeys', label: 'API keys' },
  { key: 'companyKeys', label: 'company keys' },
];

function isPayer(value: unknown): value is Payer {
  return value === 'company' || value === 'owner';
}

function TradeoffLine({ good, text }: Tradeoff) {
  const Icon = good ? Check : X;
  return (
    <li className="flex items-center gap-1.5">
      <Icon
        size={14}
        className={good ? 'text-success-indicator' : 'text-warning-indicator'}
        aria-label={good ? 'Yes' : 'No'}
      />
      <Txt as="span" variant="body-sm" tone={good ? 'ink' : 'muted'}>
        {text}
      </Txt>
    </li>
  );
}

function PayerCards({ value, onChange }: { value: Payer; onChange: (payer: Payer) => void }) {
  return (
    <RadioGroup
      aria-label="Who pays for board work"
      value={value}
      onValueChange={next => {
        if (isPayer(next)) onChange(next);
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {PAYERS.map(({ value: payer, icon: Icon, title, detail, tradeoffs }) => (
        <label
          key={payer}
          className={cn(
            raisedSurfaceStyle,
            'flex cursor-pointer flex-col gap-4 rounded-xl p-4',
            payer === value && 'ring-foreground ring-1',
          )}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="bg-fill grid size-9 place-items-center rounded-lg">
              <Icon size={18} aria-hidden />
            </span>
            <RadioGroupItem value={payer} />
          </span>
          <span className="flex flex-col gap-0.5">
            <Txt as="span" variant="label" tone="ink">
              {title}
            </Txt>
            <Txt as="span" variant="caption" tone="muted">
              {detail}
            </Txt>
          </span>
          <ul className="flex flex-col gap-1">
            {tradeoffs.map(tradeoff => (
              <TradeoffLine key={tradeoff.text} {...tradeoff} />
            ))}
          </ul>
        </label>
      ))}
    </RadioGroup>
  );
}

function personalSessionsLine(state: StoryState): string {
  if (!state.personalSessions) return 'Personal sessions are off.';
  if (!ownPlansAllowed(state)) return 'Personal sessions run on this key too; members connect nothing.';
  const allowed = PERSONAL_LABELS.filter(({ key }) => state.allowed[key]).map(({ label }) => label);
  return allowed.length > 0
    ? `Personal sessions use members’ own ${allowed.join(', ')}.`
    : 'Personal sessions are off.';
}

function accountLine(state: StoryState, account: Plan): string {
  if (account.kind === 'subscription')
    return `Your ${account.label} runs every card. Check ${providerDisplayName(account.provider)}’s terms: some plans don’t allow automated use. Swap it for a company key anytime.`;
  return `${personalSessionsLine(state)} Change it in Settings.`;
}

function ConnectedAccount({ state, account }: { state: StoryState; account: Plan }) {
  return (
    <div className={cn(raisedSurfaceStyle, 'flex flex-col gap-1 rounded-xl px-4 py-3')}>
      <div className="flex items-center gap-2">
        <ProviderLogo providerId={account.provider} size={16} />
        <Txt as="span" variant="label" tone="ink" className="min-w-0 flex-1 truncate">
          {account.label}
        </Txt>
        <Badge size="sm" variant="success" emphasis="subtle" icon={<Check aria-hidden />}>
          Connected
        </Badge>
      </div>
      <Txt as="span" variant="caption" tone="muted">
        {accountLine(state, account)}
      </Txt>
    </div>
  );
}

function AccountPicker({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const connect = (plan: Plan) => patch({ sharedAccount: plan, providerKeys: [] });
  const account = state.sharedAccount;
  const picked = (kind: Plan['kind']) => (account?.kind === kind ? account.provider : undefined);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StoryProviderPicker kind="api-key" state={state} value={picked('api-key')} onPick={connect} />
      {factoryKeys(state).length === 0 && (
        <StoryProviderPicker kind="subscription" state={state} value={picked('subscription')} onPick={connect} />
      )}
    </div>
  );
}

function BoardPreview({ state, account }: { state: StoryState; account: Plan | null }) {
  return (
    <div className="flex flex-col gap-2">
      <Txt as="span" variant="caption" tone="muted">
        Your board
      </Txt>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WORK_LANES.map(({ stage, label }) => {
          const model = account ? (state.laneModels[stage]?.model ?? account.model) : null;
          const provider = model ? providerOf(model) : undefined;
          return (
            <li key={stage} className="border-border flex flex-col gap-1 rounded-lg border border-dashed px-3 py-2">
              <Txt as="span" variant="label" tone="ink">
                {label}
              </Txt>
              <Txt as="span" variant="meta" tone="muted" className="flex min-w-0 items-center gap-1">
                {provider && <ProviderLogo providerId={provider} size={12} />}
                <span className="truncate">
                  {model ?? (ownPlansAllowed(state) ? 'Owner’s plan' : 'Waits for an account')}
                </span>
              </Txt>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StoryOnboardingAccount({
  storyboard,
  flow,
  onLand,
}: {
  storyboard: Storyboard;
  flow: OnboardingFlow;
  onLand: () => void;
}) {
  const { state, patch } = storyboard;
  const account = state.sharedAccount;
  const { factoryId } = useParams<{ factoryId: string }>();
  const navigate = useNavigate();
  const land = () => {
    onLand();
    if (factoryId) void navigate(`/factories/${factoryId}/work`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PayerCards
          value={ownPlansAllowed(state) ? 'owner' : 'company'}
          onChange={payer => patch(payer === 'company' ? COMPANY_KEYS_ONLY : EACH_OWNER_PAYS)}
        />
        <Txt as="p" variant="caption" tone="muted">
          A starting point, not a lock: every lane and setting can change later.
        </Txt>
      </div>
      {!ownPlansAllowed(state) &&
        (account ? <ConnectedAccount state={state} account={account} /> : <AccountPicker storyboard={storyboard} />)}
      <BoardPreview state={state} account={account} />
      <div>
        <Button variant="primary" onClick={land}>
          {flow === 'small-team' ? 'Go to the factory' : 'Go to the board'}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
