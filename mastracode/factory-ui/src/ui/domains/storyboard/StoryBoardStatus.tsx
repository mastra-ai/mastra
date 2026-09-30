import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { BrainCircuit, ChevronDown, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import type { Plan } from './cast';
import { providerDisplayName } from '../settings/components/provider-display-name';
import { modelsOn } from './cast';

import type { Storyboard } from './StoryboardProvider';
import { useStoryboard } from './StoryboardProvider';
import { StoryExplain, StorySettingsLink } from './StoryExplain';
import type { SettingsAnchor } from './storyLinks';
import { storySettingsPath } from './storyLinks';
import type { LaneModel } from './storyState';
import { autoRunBlocked } from './storyState';
import { StoryAdminLocked } from './StoryAdminLocked';

function StatusPill({
  variant,
  icon,
  label,
  explanation,
  anchor,
  fixLabel,
}: {
  variant: BadgeVariant;
  icon: ReactNode;
  label: string;
  explanation: string;
  anchor: SettingsAnchor;
  fixLabel?: string;
}) {
  return (
    <StoryExplain
      title={label}
      trigger={
        <button type="button">
          <Badge size="sm" variant={variant} icon={icon}>
            {label}
          </Badge>
        </button>
      }
      actions={<StorySettingsLink anchor={anchor}>{fixLabel}</StorySettingsLink>}
    >
      {explanation}
    </StoryExplain>
  );
}

const PLAN_KIND_LABELS: Record<Plan['kind'], string> = { subscription: 'Subscription', 'api-key': 'API key' };

const FACTORY_DEFAULT = 'factory-default';

function BoardDefaultPicker({ storyboard, account, board }: { storyboard: Storyboard; account: Plan; board: string }) {
  const { state, patch } = storyboard;
  const picked = state.boardModels[board];
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="sm" aria-label={`Board default: ${picked?.model ?? account.model}`}>
        {picked?.model ?? account.model}
        <ChevronDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        <DropdownMenu.Label>Lanes on this board without their own model run</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={picked?.model ?? FACTORY_DEFAULT}
          onValueChange={value => {
            const model = modelsOn(account).find(option => option === value);
            const next: LaneModel | undefined = model ? { model, thinking: 'medium' } : undefined;
            const boardModels = { ...state.boardModels, [board]: next };
            patch({ boardModels });
          }}
        >
          <DropdownMenu.RadioItem value={FACTORY_DEFAULT}>Factory default · {account.model}</DropdownMenu.RadioItem>
          {modelsOn(account).map(model => (
            <DropdownMenu.RadioItem key={model} value={model}>
              {model}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function BoardDefault({ storyboard, board }: { storyboard: Storyboard; board: string }) {
  const { state } = storyboard;
  const account = state.sharedAccount;
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const ownersPlans = state.factoryWorkRunsOn === 'owner';
  const picked = state.boardModels[board];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <Txt as="span" variant="meta" tone="muted">
        Board default
      </Txt>
      {ownersPlans && (
        <Txt as="span" variant="meta" tone="ink">
          Each card's owner plan
        </Txt>
      )}
      {!ownersPlans && account && state.viewerRole === 'admin' && (
        <BoardDefaultPicker storyboard={storyboard} account={account} board={board} />
      )}
      {!ownersPlans && account && state.viewerRole === 'member' && (
        <StoryAdminLocked what="the board default" label={`Board default: ${picked?.model ?? account.model}`}>
          {picked?.model ?? account.model}
        </StoryAdminLocked>
      )}
      {!ownersPlans && account && (
        <Txt as="span" variant="meta" tone="faint">
          {picked ? 'set for this board' : 'from Factory default'}
        </Txt>
      )}
      <span className="bg-border h-4 w-px" aria-hidden />
      <Txt as="span" variant="meta" tone="muted">
        {ownersPlans && 'Billed to whoever owns the card'}
        {!ownersPlans &&
          account &&
          `${account.label} · ${providerDisplayName(account.provider)} · ${PLAN_KIND_LABELS[account.kind]}`}
        {!ownersPlans && !account && 'Factory account'}
      </Txt>
      {!ownersPlans && (
        <Link to={storySettingsPath(factoryId, 'factory-work')} className="hover:underline">
          <Txt
            as="span"
            variant="meta"
            className={account && !account.disconnected ? 'text-success-indicator' : 'text-destructive-indicator'}
          >
            {account && !account.disconnected ? 'Connected' : 'Not connected'}
          </Txt>
        </Link>
      )}
    </div>
  );
}

export function StoryBoardStatus({ board }: { board: string }) {
  const storyboard = useStoryboard();
  if (storyboard === null) return null;
  const { state } = storyboard;
  const pausedThreads = state.cards.length;

  return (
    <div
      className="border-border order-last flex basis-full flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3"
      data-testid="story-board-status"
    >
      <BoardDefault storyboard={storyboard} board={board} />
      {autoRunBlocked(state) && (
        <StatusPill
          variant="warning"
          icon={<TriangleAlert aria-hidden />}
          label="Auto-start paused — no Factory account"
          explanation="With nobody around, only the Factory account can pay for a run. Connect one to turn auto-start back on."
          anchor="factory-work"
          fixLabel="Connect a Factory account"
        />
      )}
      {state.memory.broken && (
        <StatusPill
          variant="destructive"
          icon={<BrainCircuit aria-hidden />}
          label={`Memory model failing — ${pausedThreads} ${pausedThreads === 1 ? 'thread' : 'threads'} paused`}
          explanation={`${state.memory.model} runs observational memory and is failing. Every thread that needs it pauses until it is fixed.`}
          anchor="memory"
          fixLabel="Fix the memory model"
        />
      )}
    </div>
  );
}
