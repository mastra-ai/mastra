import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import { ChevronDown, CornerDownRight, Pin, PlugZap, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import type { Plan } from './cast';
import { actorName, PERSONA_IDS, providerOf } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { useStoryboard } from './StoryboardProvider';
import { storyLane } from './storyBoards';
import { thinkingLabel } from './storyBillingCopy';
import { resolveLaneRunner } from './laneRunner';
import { StoryAdminLocked } from './StoryAdminLocked';
import { StoryLaneAutomations } from './StoryLaneAutomations';
import { factorySource, LanePayerPicker, LanePickers, OWNER_SOURCE } from './StoryLanePickers';
import { StoryLaneRunner } from './StoryLaneRunner';
import { StoryLaneSkills } from './StoryLaneSkills';
import { storySettingsPath } from './storyLinks';
import { skillsOnLane } from './storySkills';
import type { StoryState } from './storyState';
import { factoryKeyFor, laneModelFor, laneRunsOn, ownerLaneModel } from './storyState';

type LaneLabel = { model: string; origin: string | null; billing: string };

function laneModelLabel(state: StoryState, stageId: string, board: string): LaneLabel {
  const override = state.laneFunding[stageId] === undefined ? null : 'This lane only';
  if (laneRunsOn(state, stageId) === 'owner') {
    const lane = state.laneModels[stageId];
    const billing = 'Each card bills whoever owns it';
    if (lane) {
      const origin = [override, "Default on each owner's plan"].filter(Boolean).join(' · ');
      return { model: `${lane.model} · ${thinkingLabel(lane.thinking)}`, origin, billing };
    }
    const skill = skillsOnLane(stageId)[0]?.name;
    return { model: skill ? `Owner's model · ${skill} skill` : "Owner's model", origin: override, billing };
  }
  const account = state.sharedAccount;
  if (account === null)
    return { model: 'No Factory account', origin: override, billing: 'Cards landing here wait for one' };
  const lane = laneModelFor(state, stageId, board);
  const billing = `billed to ${(lane && factoryKeyFor(state, lane.model))?.label ?? account.label}`;
  const origin = (modelOrigin: string) => [override, modelOrigin].filter(Boolean).join(' · ');
  if (!lane) return { model: account.model, origin: origin('Inherits Factory default'), billing };
  const model = `${lane.model} · ${thinkingLabel(lane.thinking)}`;
  const runner = resolveLaneRunner(state, stageId);
  if (runner.kind === 'agent') return { model, origin: origin(`Set by ${runner.agent.name}`), billing };
  const own = state.laneModels[stageId];
  if (!own) return { model, origin: origin('Inherits board default'), billing };
  return { model, origin: origin(own.locked ? 'Every card here uses it' : 'Set for this lane'), billing };
}

function OwnerPlanRows({ state, stageId }: { state: StoryState; stageId: string }) {
  return PERSONA_IDS.map(persona => (
    <Txt key={persona} variant="meta" tone="muted" className="flex justify-between gap-2 px-2 py-1">
      <span className="text-foreground">{actorName(persona)}</span>
      <span className="truncate">{memberPlanLine(state, state.memberPlans[persona], stageId)}</span>
    </Txt>
  ));
}

function memberPlanLine(state: StoryState, plan: Plan | null, stageId: string): string {
  if (!plan) return 'no plan: their cards wait';
  if (plan.disconnected) return `${plan.label} · disconnected: their cards pause`;
  const { model, fallbackFrom } = ownerLaneModel(state, plan, stageId);
  return `${plan.label} · ${model}${fallbackFrom ? `, can't run ${fallbackFrom}` : ''}`;
}

function ConnectAccountItem({ onConnect }: { onConnect: () => void }) {
  return (
    <DropdownMenu.Item
      onClick={onConnect}
      className="bg-warning-subtle text-warning-subtle-foreground not-disabled:hover:bg-warning-subtle not-disabled:hover:text-warning-subtle-foreground data-highlighted:bg-warning-subtle [&_svg]:text-warning-indicator mb-1 h-auto items-start py-2"
    >
      <PlugZap aria-hidden />
      <span className="flex flex-col items-start gap-0.5">
        <span className="font-medium">Connect a Factory account</span>
        <span className="text-xs">Cards in this lane wait until one pays</span>
      </span>
    </DropdownMenu.Item>
  );
}

function LaneModelFace({
  state,
  stageId,
  model,
  board,
}: {
  state: StoryState;
  stageId: string;
  model: string;
  board: string;
}) {
  const factoryPays = laneRunsOn(state, stageId) === 'shared';
  const account = factoryPays ? state.sharedAccount : null;
  const laneProvider = providerOf(laneModelFor(state, stageId, board)?.model ?? '');
  const logo = factoryPays ? account && (laneProvider ?? account.provider) : laneProvider;
  return (
    <>
      <CornerDownRight aria-hidden />
      {logo && <ProviderLogo providerId={logo} size={14} />}
      <span className="max-w-60 truncate">{model}</span>
      {state.laneModels[stageId]?.locked && factoryPays && <Pin aria-label="Every card here uses it" />}
    </>
  );
}

function LaneModelMenu({
  storyboard,
  stageId,
  model,
  label,
  board,
}: {
  storyboard: Storyboard;
  stageId: string;
  model: string;
  label: string;
  board: string;
}) {
  const { state } = storyboard;
  const factoryPays = laneRunsOn(state, stageId) === 'shared';
  const account = factoryPays ? state.sharedAccount : null;
  const runner = resolveLaneRunner(state, stageId);
  const navigate = useNavigate();
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const openSettings = () => navigate(storySettingsPath(factoryId, 'factory-work'));

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="sm" aria-label={label} className="-ml-2">
        <LaneModelFace state={state} stageId={stageId} model={model} board={board} />
        <ChevronDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-72">
        {factoryPays && !state.sharedAccount && <ConnectAccountItem onConnect={openSettings} />}
        <LanePayerPicker storyboard={storyboard} stageId={stageId} />
        {account && runner.kind !== 'agent' && (
          <LanePickers storyboard={storyboard} stageId={stageId} source={factorySource(state, account)} lockable />
        )}
        {!factoryPays && (
          <LanePickers storyboard={storyboard} stageId={stageId} source={OWNER_SOURCE} lockable={false} />
        )}
        {account && runner.kind === 'agent' && (
          <DropdownMenu.Label>
            {runner.agent.name} picks its own model: {runner.agent.model}. Switch the runner to change it.
          </DropdownMenu.Label>
        )}
        {!factoryPays && (
          <>
            <DropdownMenu.Label>What each owner runs here</DropdownMenu.Label>
            <OwnerPlanRows state={state} stageId={stageId} />
          </>
        )}
        {state.sharedAccount && (
          <DropdownMenu.Item onClick={openSettings}>
            <Settings aria-hidden />
            Factory keys in Settings
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function StoryLaneModel({
  storyboard,
  stageId,
  board,
}: {
  storyboard: Storyboard;
  stageId: string;
  board: string;
}) {
  const { state } = storyboard;
  const { model, origin, billing } = laneModelLabel(state, stageId, board);
  const caption = [origin, billing].filter(part => part !== null).join(' · ');
  const label = `Lane model: ${model}, ${origin ?? billing}`;

  return (
    <div className="flex min-w-0 flex-col items-start">
      {state.viewerRole === 'admin' ? (
        <LaneModelMenu storyboard={storyboard} stageId={stageId} model={model} label={label} board={board} />
      ) : (
        <StoryAdminLocked what="lanes" label={label} className="-ml-2">
          <LaneModelFace state={state} stageId={stageId} model={model} board={board} />
        </StoryAdminLocked>
      )}
      {caption && (
        <Txt as="span" variant="meta" tone="faint">
          {caption}
        </Txt>
      )}
    </div>
  );
}

export function useStoryLaneDetails(board: string): (stageId: string) => ReactNode {
  const storyboard = useStoryboard();
  return stageId =>
    storyboard === null ? undefined : (
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        {storyLane(storyboard.state.boardLayout, stageId) ? (
          <StoryLaneModel storyboard={storyboard} stageId={stageId} board={board} />
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-1">
          {storyLane(storyboard.state.boardLayout, stageId) && (
            <>
              <StoryLaneRunner storyboard={storyboard} stageId={stageId} />
              <StoryLaneSkills stageId={stageId} />
            </>
          )}
          <StoryLaneAutomations storyboard={storyboard} stageId={stageId} />
        </div>
      </div>
    );
}
