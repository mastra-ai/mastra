import type { Agent } from '@mastra/core/agent';
import type { MastraBrowser } from '@mastra/core/browser';
import type {
  CustomModelCatalogProvider,
  HarnessMode as LegacyHarnessMode,
  HarnessSubagent as LegacyHarnessSubagent,
  HeartbeatHandler,
  ModelAuthChecker,
  ModelUseCountProvider,
  ModelUseCountTracker,
} from '@mastra/core/harness';
import type { HarnessMode as HarnessV1Mode, SubagentDefinition } from '@mastra/core/harness/v1';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { DynamicArgument } from '@mastra/core/types';
import type { Workspace } from '@mastra/core/workspace';
import type { Observability } from '@mastra/observability';

export const MASTRACODE_HARNESS_NAME = 'mastra-code';
export const MASTRACODE_RUNTIME_COMPATIBILITY_GENERATION = 'mastracode-harness-v1-runtime-2026-05-22';

export type HarnessV1ModelAuthStatus = 'authenticated' | 'needs_auth' | 'unknown';

export interface MastraCodeModelInfo {
  id: string;
  providerId: string;
  displayName?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MastraCodeRuntimeConfig<TState extends Record<string, unknown>> {
  resourceId: string;
  storage: MastraCompositeStore;
  observability?: Observability;
  memory?: DynamicArgument<MastraMemory>;
  agents: Record<string, Agent>;
  modes: LegacyHarnessMode<TState>[];
  subagents: LegacyHarnessSubagent[];
  initialState: TState;
  workspace?: (ctx: { requestContext: RequestContext; mastra?: Mastra }) => Workspace | Promise<Workspace>;
  toolCategoryResolver?: (toolName: string) => any;
  heartbeatHandlers?: HeartbeatHandler[];
  modelAuthChecker?: ModelAuthChecker;
  modelUseCountProvider?: ModelUseCountProvider;
  modelUseCountTracker?: ModelUseCountTracker;
  customModelCatalogProvider?: CustomModelCatalogProvider;
  resolveModel?: (modelId: string) => unknown;
  disabledTools?: string[];
  browser?: DynamicArgument<MastraBrowser | undefined>;
}

/**
 * Resolve the runtime's default mode from configured modes.
 * Callers must provide at least one valid mode; the runtime should never
 * invent a mode id that the Harness v1 config cannot resolve.
 */
export function resolveDefaultModeId<TState>(modes: LegacyHarnessMode<TState>[]): string {
  if (modes.length === 0) {
    throw new Error('No MastraCode harness modes configured');
  }
  const defaultMode = modes.find(mode => mode.default);
  return defaultMode?.id ?? modes[0]!.id;
}

function modeAgentId(modeId: string): string {
  return `mode-${modeId}-agent`;
}

function subagentAgentId(subagentId: string): string {
  return `subagent-${subagentId}`;
}

export function subagentModeId(subagentId: string): string {
  return `mastracode-subagent-${subagentId}`;
}

export function toHarnessV1Agents<TState>(
  baseAgents: Record<string, Agent>,
  modes: LegacyHarnessMode<TState>[],
  initialState: TState,
): Record<string, Agent> {
  const agents = { ...baseAgents };
  for (const mode of modes) {
    if (typeof mode.agent === 'function') {
      agents[modeAgentId(mode.id)] = mode.agent(initialState);
      continue;
    }
    if (Object.values(agents).includes(mode.agent)) continue;
    agents[modeAgentId(mode.id)] = mode.agent;
  }
  return agents;
}

export function toHarnessV1Modes<TState>(
  modes: LegacyHarnessMode<TState>[],
  agents: Record<string, Agent>,
  defaultModeId: string,
  subagents: LegacyHarnessSubagent[] = [],
): HarnessV1Mode[] {
  const agentIdsByInstance = new Map(Object.entries(agents).map(([id, agent]) => [agent, id] as const));
  return [
    ...modes.map(mode => ({
      id: mode.id,
      agentId:
        typeof mode.agent === 'function' ? modeAgentId(mode.id) : (agentIdsByInstance.get(mode.agent) ?? modeAgentId(mode.id)),
      description: mode.name,
      transitionsTo: mode.id === 'plan' && defaultModeId !== 'plan' ? defaultModeId : undefined,
      metadata: {
        name: mode.name,
        color: mode.color,
        default: mode.default,
        defaultModelId: mode.defaultModelId,
        legacyDynamicAgent: typeof mode.agent === 'function' ? true : undefined,
      },
    })),
    ...subagents.map(subagent => ({
      id: subagentModeId(subagent.id),
      agentId: subagentAgentId(subagent.id),
      description: subagent.name,
      metadata: {
        name: subagent.name,
        defaultModelId: subagent.defaultModelId,
        mastracodeSubagent: subagent.id,
      },
    })),
  ];
}

export function toHarnessV1Subagents(subagents: LegacyHarnessSubagent[]): Record<string, SubagentDefinition> {
  return Object.fromEntries(
    subagents.map(subagent => {
      if (subagent.allowedHarnessTools && subagent.allowedHarnessTools.length > 0) {
        throw new Error(
          `MastraCode Harness v1 native subagents do not support allowedHarnessTools for "${subagent.id}" yet; ` +
            'inline the tools on the subagent or move them to allowedWorkspaceTools.',
        );
      }
      return [
        subagent.id,
        {
          agentId: `subagent-${subagent.id}`,
          modeId: subagentModeId(subagent.id),
          description: subagent.description,
          defaultModelId: subagent.defaultModelId,
          forked: subagent.forked,
          tools: subagent.tools,
          allowedWorkspaceTools: subagent.allowedWorkspaceTools,
          maxSteps: subagent.maxSteps,
          stopWhen: subagent.stopWhen,
          workspace: 'inherit',
        },
      ];
    }),
  );
}

export function toModelInfo(model: {
  id: string;
  provider: string;
  modelName: string;
  hasApiKey?: boolean;
  apiKeyEnvVar?: string;
}): MastraCodeModelInfo {
  return {
    id: model.id,
    providerId: model.provider,
    displayName: model.modelName,
    metadata: {
      modelName: model.modelName,
      hasApiKey: Boolean(model.hasApiKey),
      apiKeyEnvVar: model.apiKeyEnvVar,
    },
  };
}

export function toHarnessV1AuthStatus(hasAuth: boolean | undefined): HarnessV1ModelAuthStatus {
  if (hasAuth === true) return 'authenticated';
  if (hasAuth === false) return 'needs_auth';
  return 'unknown';
}
