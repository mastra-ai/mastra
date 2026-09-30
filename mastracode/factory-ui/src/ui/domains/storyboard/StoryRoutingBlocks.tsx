import { Txt } from '@mastra/playground-ui/components/Txt';

import { backgroundRows, factoryConversations, personalConversations } from './modelRouting';
import type { FlowRow } from './modelRouting';
import type { Storyboard } from './StoryboardProvider';
import type { FlowControls } from './StoryFlowRows';
import { StoryFlowRows } from './StoryFlowRows';
import { StoryMemoryNotice, StoryMemoryPicker } from './StoryMemorySettings';
import { PolicyBlock, SettingSelect } from './StorySettingControls';
import type { SettingOption } from './StorySettingControls';
import { modelsOn } from './cast';
import { factoryKeys, factoryPaysPersonalSessions, ownPlansAllowed } from './storyState';
import type { SlackRoute, StoryState } from './storyState';
import { settingsAnchorId } from './storyLinks';

const SLACK_OPTIONS: SettingOption<SlackRoute>[] = [
  { value: 'factory', label: 'Factory session' },
  { value: 'personal', label: 'Personal session' },
];

function SlackRoutePicker({
  storyboard: { state, patch },
  route,
}: {
  storyboard: Storyboard;
  route: keyof StoryState['slack'];
}) {
  return (
    <SettingSelect
      label={route === 'channel' ? 'Channel mentions start' : 'Direct messages start'}
      value={state.slack[route]}
      options={SLACK_OPTIONS}
      onChange={next => patch({ slack: { ...state.slack, [route]: next } })}
      className="w-44"
    />
  );
}

export function StoryFactoryConversations({ storyboard }: { storyboard: Storyboard }) {
  const routable = ownPlansAllowed(storyboard.state);
  const controlsFor = (row: FlowRow): FlowControls => {
    if (!routable) return {};
    if (row.id === 'slack-channel') return { route: <SlackRoutePicker storyboard={storyboard} route="channel" /> };
    if (row.id === 'slack-dm') return { route: <SlackRoutePicker storyboard={storyboard} route="dm" /> };
    return {};
  };
  return (
    <PolicyBlock id={settingsAnchorId('slack')} title="Conversations">
      <StoryFlowRows
        rows={factoryConversations(storyboard.state)}
        state={storyboard.state}
        controlsFor={controlsFor}
        columns={{
          source: 'Starts from',
          model: 'Model',
          payer: 'Billed to',
          route: routable ? 'Starts as' : undefined,
        }}
      />
    </PolicyBlock>
  );
}

export function StoryBackground({ storyboard }: { storyboard: Storyboard }) {
  const controlsFor = (row: FlowRow): FlowControls =>
    row.id === 'memory' ? { model: <StoryMemoryPicker storyboard={storyboard} /> } : {};
  return (
    <PolicyBlock id={settingsAnchorId('memory')} title="Background">
      <StoryFlowRows
        rows={backgroundRows(storyboard.state)}
        state={storyboard.state}
        controlsFor={controlsFor}
        columns={{ source: 'Runs', model: 'Model', payer: 'Billed to' }}
      />
      <StoryMemoryNotice storyboard={storyboard} />
    </PolicyBlock>
  );
}

type MySessionsPayer = StoryState['mySessionsPayer'];

function MySessionsModelPicker({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const plan = state.memberPlans[state.viewer];
  if (!plan) return null;
  return (
    <SettingSelect
      label="Default model for your sessions"
      value={plan.model}
      options={modelsOn(plan).map(model => ({ value: model, label: model }))}
      onChange={model => patch({ memberPlans: { ...state.memberPlans, [state.viewer]: { ...plan, model } } })}
      className="w-40"
    />
  );
}

function MySessionsPayerPicker({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const plan = state.memberPlans[state.viewer];
  const options: SettingOption<MySessionsPayer>[] = [
    { value: 'mine', label: plan ? `Your ${plan.label}` : 'Your plan' },
    { value: 'factory', label: state.sharedAccount?.label ?? 'Factory account' },
  ];
  return (
    <SettingSelect
      label="Who pays for your sessions"
      value={state.mySessionsPayer}
      options={options}
      onChange={mySessionsPayer => patch({ mySessionsPayer })}
      className="w-48"
    />
  );
}

function mySessionsPayerWhy(state: StoryState): string {
  if (state.sharedAccount === null) return 'Only your plan can pay: the Factory has no account connected.';
  return "Only your plan can pay: your Factory doesn't let personal sessions use its account.";
}

function CompanyModelPicker({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const models = [...new Set(factoryKeys(state).flatMap(key => modelsOn(key)))];
  const current = state.mySessionsModel?.model ?? state.sharedAccount?.model;
  if (!current || models.length === 0) return null;
  return (
    <SettingSelect
      label="Default model for your sessions"
      value={current}
      options={models.map(model => ({ value: model, label: model }))}
      onChange={model => patch({ mySessionsModel: { model, thinking: state.mySessionsModel?.thinking ?? 'medium' } })}
      className="w-40"
    />
  );
}

function personalControls(storyboard: Storyboard, row: FlowRow): FlowControls {
  const { state } = storyboard;
  if (!ownPlansAllowed(state)) {
    const payerWhy = 'Your Factory runs on company keys only.';
    const pickable = row.status !== 'off' && (row.id === 'sessions' || row.id === 'slack-dm');
    return pickable ? { model: <CompanyModelPicker storyboard={storyboard} />, payerWhy } : { payerWhy };
  }
  if (row.id === 'sessions' && row.status !== 'off')
    return {
      model: <MySessionsModelPicker storyboard={storyboard} />,
      ...(factoryPaysPersonalSessions(state)
        ? { payer: <MySessionsPayerPicker storyboard={storyboard} /> }
        : { payerWhy: mySessionsPayerWhy(state) }),
    };
  if (row.id === 'slack-dm')
    return {
      payerWhy:
        state.slack.dm === 'personal'
          ? 'Slack DMs start personal sessions. Your Factory decides this.'
          : 'Slack DMs start Factory sessions. Your Factory decides this.',
    };
  if (row.id === 'cards') return { payerWhy: "Board work runs on each card owner's plan. Your Factory decides this." };
  return {};
}

export function StoryPersonalConversations({ storyboard }: { storyboard: Storyboard }) {
  return (
    <PolicyBlock title="Conversations">
      <StoryFlowRows
        rows={personalConversations(storyboard.state)}
        state={storyboard.state}
        controlsFor={row => personalControls(storyboard, row)}
        columns={{ source: 'Conversation', model: 'Default model', payer: 'Billed to' }}
      />
      <Txt as="p" variant="meta" tone="muted" className="border-border border-t px-4 py-2">
        Defaults for every new conversation. Picking another model in the composer changes that conversation only.
      </Txt>
    </PolicyBlock>
  );
}
