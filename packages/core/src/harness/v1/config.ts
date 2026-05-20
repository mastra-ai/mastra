import type { Agent } from '../../agent';
import type { ToolsInput } from '../../agent/types';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { MastraCompositeStore } from '../../storage/base';
import type { HarnessStorage } from '../../storage/domains/harness';
import type { Workspace } from '../../workspace';
import type { HarnessMode, ToolCategory } from './shared';
import type {
  CustomModelCatalogProvider,
  ModelAuthChecker,
  ModelAuthStatus,
  ModelInfo,
  ModelUseCountProvider,
  ModelUseCountTracker,
  PermissionPolicy,
  SubagentDefinition,
} from './types';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

export type { WorkspaceOwnershipKind, WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

export type HarnessStorageLike = HarnessStorage;

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
  id?: string;
  resourceId?: string;
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
    immediate?: boolean;
    handler: (ctx: { harnessId: string; abortSignal: AbortSignal }) => void | Promise<void>;
    shutdown?: () => void | Promise<void>;
  }>;
  defaultPermissionPolicy?: PermissionPolicy;
  toolCategoryResolver?: (toolName: string) => ToolCategory | null;
  toolCategories?: Record<string, ToolCategory>;
  models?: ModelInfo[];
  resolveModel?: (params: { modeId?: string; agentId?: string; resourceId?: string }) => string | Promise<string>;
  modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;
  modelAuthChecker?: ModelAuthChecker;
  modelUseCountProvider?: ModelUseCountProvider;
  modelUseCountTracker?: ModelUseCountTracker;
  customModelCatalogProvider?: CustomModelCatalogProvider;
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

export interface HarnessObservationalMemoryConfig {
  enabled?: boolean;
  observerModel?: string;
  reflectorModel?: string;
  observeThreshold?: number;
  reflectThreshold?: number;
}
