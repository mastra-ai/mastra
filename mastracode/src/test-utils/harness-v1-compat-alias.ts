import type { Agent } from '@mastra/core/agent';
import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessMode as HarnessModeV1, SubagentRegistryConfig } from '@mastra/core/harness/v1';
import type { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { HarnessCompat } from '../HarnessCompat.js';
import { getHarnessTestControls, recordHarnessConfig } from './harness-test-captures.js';

export {
  askUserTool,
  assignTaskIds,
  parseSubagentMeta,
  submitPlanTool,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool,
} from '../../../packages/core/src/harness/tools.js';
export { defaultDisplayState, defaultOMProgressState } from '../../../packages/core/src/harness/types.js';
export {
  toNotificationContent,
  toNotificationSummaryContent,
  toReactiveSignalContent,
  toStateSignalContent,
  toSystemReminderContent,
  toUserSignalMessage,
} from '../../../packages/core/src/harness/harness.js';
export type * from '../../../packages/core/src/harness/index.js';


type LegacyMode<TState = {}> = HarnessModeV1 & {
  name?: string;
  color?: string;
  default?: boolean;
  agent?: Agent | ((state: TState) => Agent);
};

type LegacySubagent = {
  id: string;
  name: string;
  description: string;
  instructions?: unknown;
  tools?: unknown;
  allowedHarnessTools?: string[];
  defaultModelId?: string;
  maxSteps?: number;
  stopWhen?: unknown;
  allowedWorkspaceTools?: string[];
  forked?: boolean;
};

type LegacyHarnessConfig<TState = {}> = {
  id?: string;
  resourceId?: string;
  storage?: unknown;
  stateSchema?: unknown;
  initialState?: Partial<TState>;
  memory?: unknown;
  modes: LegacyMode<TState>[];
  workspace?: unknown;
  browser?: unknown;
  subagents?: LegacySubagent[];
  toolCategoryResolver?: unknown;
  permissionRules?: unknown;
  defaultPermissionPolicy?: unknown;
  sessionGrants?: unknown;
  onPermissionRequested?: unknown;
  modelAuthChecker?: unknown;
  modelUseCountProvider?: unknown;
  modelUseCountTracker?: unknown;
  customModelCatalogProvider?: unknown;
};

const TEST_OWNER_ID = 'mastracode-vitest-harness-v1-compat';

function resolveDefaultAgent<TState>(config: LegacyHarnessConfig<TState>): Agent {
  const mode = config.modes[0];
  const agent = typeof mode?.agent === 'function' ? mode.agent(config.initialState as TState) : mode?.agent;
  if (!agent) {
    throw new Error('Harness V1 compatibility alias requires at least one legacy mode with an agent');
  }
  return agent;
}

function toV1Mode<TState>(mode: LegacyMode<TState>): HarnessModeV1 {
  const { name, color, default: isDefault, agent: _agent, metadata, defaultModelId, ...modeConfig } = mode;
  return {
    ...modeConfig,
    defaultModelId: defaultModelId ?? 'mock/model',
    metadata: {
      ...metadata,
      ...(name === undefined ? {} : { name }),
      ...(color === undefined ? {} : { color }),
      ...(isDefault === undefined ? {} : { default: isDefault }),
    },
  };
}

function toSubagentRegistry(subagents: LegacySubagent[] | undefined): SubagentRegistryConfig | undefined {
  if (!subagents?.length) return undefined;

  return {
    maxDepth: 1,
    types: Object.fromEntries(
      subagents.map(subagent => {
        const { id, ...definition } = subagent;
        return [id, { ...definition, agentId: 'default' }];
      }),
    ),
  } as SubagentRegistryConfig;
}

export class Harness<TState = {}> extends HarnessCompat<TState> {
  constructor(config: LegacyHarnessConfig<TState>) {
    recordHarnessConfig(config);

    const defaultAgent = resolveDefaultAgent(config);
    const modes = config.modes.map(toV1Mode);
    const memory = config.memory ?? new Memory({ storage: config.storage as never });
    const defaultModeId =
      modes.find(mode => mode.metadata?.default === true)?.id ?? modes.find(mode => mode.id === 'plan')?.id ?? modes[0]?.id;

    if (!defaultModeId) {
      throw new Error('Harness V1 compatibility alias requires at least one mode');
    }

    const harnessV1 = new HarnessV1({
      ownerId: TEST_OWNER_ID,
      agent: defaultAgent,
      memory: memory as never,
      modes,
      defaultModeId,
      storage: config.storage as never,
      gateways: [],
      stateSchema: config.stateSchema as never,
      initialState: config.initialState,
      workspace: (typeof config.workspace === 'function' ? config.workspace : undefined) as never,
      subagents: toSubagentRegistry(config.subagents),
      toolCategoryResolver: config.toolCategoryResolver as never,
      permissionRules: config.permissionRules as never,
      defaultPermissionPolicy: config.defaultPermissionPolicy as never,
      sessionGrants: config.sessionGrants as never,
      onPermissionRequested: config.onPermissionRequested as never,
    });

    super(
      {
        id: config.id,
        resourceId: config.resourceId ?? 'default',
        mastra: {} as Mastra,
        memory: memory as never,
        modes,
        defaultModeId,
        initialState: config.initialState,
        defaultAgent,
        workspace: config.workspace,
        browser: config.browser,
        modelAuthChecker: config.modelAuthChecker as never,
        modelUseCountProvider: config.modelUseCountProvider as never,
        modelUseCountTracker: config.modelUseCountTracker as never,
        customModelCatalogProvider: config.customModelCatalogProvider as never,
      },
      harnessV1,
    );
  }

  override subscribe(eventHandler: Parameters<HarnessCompat<TState>['subscribe']>[0]): () => void {
    const controls = getHarnessTestControls();
    const unsubscribe = controls?.subscribe?.(eventHandler);
    if (typeof unsubscribe === 'function') return unsubscribe as () => void;
    if (controls?.subscribe) return () => undefined;
    return super.subscribe(eventHandler);
  }

  override getCurrentThreadId(): string | null {
    const value = getHarnessTestControls()?.getCurrentThreadId?.();
    if (value !== undefined) return value;
    return super.getCurrentThreadId();
  }

  override getResourceId(): string {
    return getHarnessTestControls()?.getResourceId?.() ?? super.getResourceId();
  }

  override getState(): TState {
    const state = getHarnessTestControls()?.getState?.();
    if (state) return state as TState;
    return super.getState();
  }

  override listThreads(options?: Parameters<HarnessCompat<TState>['listThreads']>[0]): Promise<Awaited<ReturnType<HarnessCompat<TState>['listThreads']>>> {
    const controls = getHarnessTestControls();
    if (controls?.listThreads) return Promise.resolve(controls.listThreads(options) as never);
    return super.listThreads(options);
  }

  override setState(state: Partial<TState>): Promise<void> {
    const controls = getHarnessTestControls();
    if (controls?.setState) return Promise.resolve(controls.setState(state) as never);
    return super.setState(state);
  }

  override setThreadSetting(setting: string | { key: string; value: unknown }, value?: unknown): Promise<void> {
    const controls = getHarnessTestControls();
    if (controls?.setThreadSetting) return Promise.resolve(controls.setThreadSetting(setting, value) as never);
    return super.setThreadSetting(setting, value);
  }
}
