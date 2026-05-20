import type { Agent } from '../../agent';
import type { ToolsInput } from '../../agent/types';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { MastraCompositeStore } from '../../storage/base';
import type { Workspace } from '../../workspace';
import type { HarnessMode, ToolCategory } from './shared';
import type { ModelAuthStatus, ModelInfo, PermissionPolicy, SubagentDefinition } from './types';

export type HarnessStorageLike = unknown;

export type HarnessConfig<TState = unknown> = HarnessConfigCommon<TState> &
  (
    | {
        mastra: Mastra;
        agents?: never;
        storage?: never;
      }
    | {
        mastra?: never;
        agents?: Record<string, Agent>;
        storage?: MastraCompositeStore;
      }
  );

export interface HarnessConfigCommon<TState = unknown> {
  modes: Array<HarnessMode<TState>>;
  defaultModeId?: string;
  initialState?: TState | (() => TState | Promise<TState>);
  sessions?: {
    storage?: HarnessStorageLike;
    maxQueueDepth?: number;
    leaseTtlMs?: number;
    lockMode?: 'steal' | 'fail';
  };
  lists?: {
    defaultThreadPageSize?: number;
    defaultMessageLimit?: number;
  };
  skills?: {
    enabled?: boolean;
  };
  subagents?: {
    maxDepth?: number;
    types: Record<string, SubagentDefinition>;
  };
  files?: {
    maxAttachmentBytes?: number;
    allowedContentTypes?: string[];
  };
  goals?: {
    defaultJudgeModel?: string;
    defaultMaxTurns?: number;
  };
  workspace?: HarnessWorkspaceConfig;
  observationalMemory?: HarnessObservationalMemoryConfig;
  tools?: ToolsInput;
  intervals?: Array<{
    id: string;
    everyMs: number;
    handler: (ctx: { harnessId: string; abortSignal: AbortSignal }) => void | Promise<void>;
  }>;
  defaultPermissionPolicy?: PermissionPolicy;
  toolCategoryResolver?: (toolName: string) => ToolCategory | null;
  toolCategories?: Record<string, ToolCategory>;
  models?: ModelInfo[];
  resolveModel?: (params: { modeId?: string; agentId?: string; resourceId?: string }) => string | Promise<string>;
  modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;
}

export type HarnessWorkspaceConfig =
  | {
      kind: 'shared';
      workspace: Workspace | ((ctx: { requestContext: RequestContext }) => Workspace | Promise<Workspace>);
      eager?: boolean;
    }
  | {
      kind: 'per-resource';
      provider: WorkspaceProvider | ((ctx: WorkspaceProviderContext) => Workspace | Promise<Workspace>);
      eager?: boolean;
    }
  | {
      kind: 'per-session';
      provider: WorkspaceProvider;
      eager?: boolean;
    };

export interface WorkspaceProviderContext {
  harnessId: string;
  sessionId?: string;
  resourceId?: string;
  threadId?: string;
  requestContext: RequestContext;
}

export interface WorkspaceProvider {
  id: string;
  resumable?: boolean;
  create(ctx: WorkspaceProviderContext): Workspace | Promise<Workspace>;
  resume?(ctx: WorkspaceProviderContext & { state: unknown }): Workspace | Promise<Workspace>;
  snapshot?(workspace: Workspace): unknown | Promise<unknown>;
  destroy?(workspace: Workspace): void | Promise<void>;
}

export interface HarnessObservationalMemoryConfig {
  enabled?: boolean;
  observerModel?: string;
  reflectorModel?: string;
  observeThreshold?: number;
  reflectThreshold?: number;
}
