/**
 * The contracts the TUI renders against. A local Mastra Code runtime satisfies
 * them with the in-process `Session` / `AgentController`; a Factory runtime
 * satisfies them with thin HTTP clients. Anything outside these contracts is
 * local-only and reached through `TUIState.local`.
 */
import type {
  AgentController,
  AgentControllerMode,
  AvailableModel,
  ModelAuthStatus,
  Session,
} from '@mastra/core/agent-controller';

type LocalSession = Session<any>;

export type TuiSession = Pick<
  LocalSession,
  | 'subscribe'
  | 'sendMessage'
  | 'queueMessage'
  | 'sendSignal'
  | 'respondToToolApproval'
  | 'respondToToolSuspension'
  | 'abort'
  | 'getCurrentRunId'
> & {
  readonly identity: Pick<LocalSession['identity'], 'getResourceId' | 'getDefaultResourceId' | 'getId' | 'getOwnerId'>;
  readonly thread: Pick<
    LocalSession['thread'],
    | 'getId'
    | 'list'
    | 'create'
    | 'switch'
    | 'clone'
    | 'rename'
    | 'listMessages'
    | 'listActiveMessages'
    | 'getSetting'
    | 'setSetting'
    | 'setSettingOn'
    | 'detachFromCurrent'
    | 'cleanupSubscription'
  >;
  readonly state: Pick<LocalSession['state'], 'get' | 'set' | 'setIf' | 'update'>;
  readonly mode: Pick<LocalSession['mode'], 'get' | 'switch'> & { resolve(): TuiMode };
  readonly model: Pick<LocalSession['model'], 'get' | 'hasSelection' | 'switch'>;
  readonly displayState: Pick<LocalSession['displayState'], 'get' | 'clearModifiedFiles' | 'restoreTasks'>;
  readonly permissions: Pick<LocalSession['permissions'], 'getRules' | 'setForCategory'>;
  readonly run: Pick<LocalSession['run'], 'isRunning' | 'getTraceId'>;
  readonly stream: Pick<LocalSession['stream'], 'isActive'>;
  readonly suspensions: Pick<LocalSession['suspensions'], 'hasPending'>;
};

/** Mode fields a Factory can describe; local modes carry more. */
export type TuiMode = Pick<
  AgentControllerMode,
  'id' | 'name' | 'description' | 'defaultModelId' | 'default' | 'metadata'
>;

export interface TuiController {
  readonly id: string;
  listModes(): TuiMode[];
  listAvailableModels(): Promise<AvailableModel[]>;
  invalidateAvailableModelsCache(): void;
  getCurrentModelAuthStatus(session: TuiSession): Promise<ModelAuthStatus>;
}

/** Where a Factory-backed TUI is connected; shown in the header. */
export interface FactoryRuntimeInfo {
  projectName: string;
  repositorySlug: string;
  branch: string;
  url: string;
}

/** The in-process Mastra Code runtime; absent when running against a Factory. */
export interface LocalRuntime {
  controller: AgentController<any>;
  session: LocalSession;
}

/**
 * Returns the in-process runtime for local-only features. The command
 * dispatcher keeps local-only commands from running in Factory mode, so
 * reaching this without a local runtime is a bug.
 */
export function requireLocal(state: { local?: LocalRuntime }, feature: string): LocalRuntime {
  if (!state.local) throw new Error(`${feature} is not available in Factory mode`);
  return state.local;
}

const LOCAL_ONLY_COMMANDS = new Set([
  'thread:tag-dir',
  'sandbox',
  'workflows',
  'workflow',
  'skills',
  'packs',
  'models',
  'custom-providers',
  'subagents',
  'memory',
  'om',
  'knowledge',
  'voice',
  'connect',
  'login',
  'logout',
  'context',
  'ctx',
  'prune',
  'resource',
  'hooks',
  'mcp',
  'reload',
  'setup',
  'browser',
  'gateway',
  'memory-gateway',
  'api-keys',
  'plugins',
  'feedback',
  'observability',
  'goal',
  'schedules',
  // These read the local checkout, local gh CLI, or local config — not the Factory sandbox.
  'diff',
  'github',
  'settings',
]);

export function isLocalOnlyCommand(command: string): boolean {
  return LOCAL_ONLY_COMMANDS.has(command) || command.startsWith('goal/') || command.startsWith('skill/');
}
