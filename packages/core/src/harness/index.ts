/**
 * @deprecated Backwards-compatibility entrypoint.
 *
 * The canonical implementation now lives in `@mastra/core/agent-controller`.
 * This module re-exports that surface and additionally provides the deprecated
 * `Harness`/`Harness*` aliases. New code should import from
 * `@mastra/core/agent-controller` instead.
 */
import { AgentController } from '../agent-controller/agent-controller';
import type {
  AgentControllerConfig,
  AgentControllerDisplayState,
  AgentControllerEvent,
  AgentControllerEventListener,
  AgentControllerMessage,
  AgentControllerMessageContent,
  AgentControllerMode,
  AgentControllerOMConfig,
  AgentControllerRequestContext,
  AgentControllerRequestSession,
  AgentControllerRequestState,
  AgentControllerRequestStateUpdater,
  AgentControllerRequestStateUpdateResult,
  AgentControllerStateSchema,
  AgentControllerSubagent,
  AgentControllerSubagentHistoryEntry,
  AgentControllerThread,
} from '../agent-controller/types';

export { AgentController } from '../agent-controller/agent-controller';
export { Session } from '../agent-controller/session';
export {
  askUserTool,
  assignTaskIds,
  parseSubagentMeta,
  submitPlanTool,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool,
} from '../agent-controller/tools';
export { defaultDisplayState, defaultOMProgressState } from '../agent-controller/types';
export type {
  ActiveSubagentState,
  ActiveToolState,
  AvailableModel,
  CustomAvailableModel,
  CustomModelCatalogProvider,
  AgentControllerConfig,
  AgentControllerDisplayState,
  AgentControllerEvent,
  AgentControllerEventListener,
  AgentControllerMessage,
  AgentControllerMessageContent,
  AgentControllerMode,
  AgentControllerOMConfig,
  AgentControllerRequestContext,
  AgentControllerRequestSession,
  AgentControllerRequestState,
  AgentControllerRequestStateUpdater,
  AgentControllerRequestStateUpdateResult,
  AgentControllerStateSchema,
  AgentControllerSubagent,
  AgentControllerSubagentHistoryEntry,
  AgentControllerThread,
  IntervalHandler,
  ModelAuthStatus,
  ModelUseCountProvider,
  ModelUseCountTracker,
  OMBufferedStatus,
  OMProgressState,
  OMStatus,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
  BuiltinToolId,
  TokenUsage,
} from '../agent-controller/types';

/**
 * @deprecated Use {@link AgentController} instead. `Harness` is retained as a
 * backwards-compatible alias and will be removed in a future major release.
 */
export const Harness = AgentController;
/**
 * @deprecated Use {@link AgentController} instead. `Harness` is retained as a
 * backwards-compatible alias and will be removed in a future major release.
 */
export type Harness<TState = {}> = AgentController<TState>;

/**
 * @deprecated Renamed to `AgentControllerMode`. Kept for backwards compatibility.
 */
export type HarnessMode = AgentControllerMode;
/**
 * @deprecated Renamed to `AgentControllerSubagent`. Kept for backwards compatibility.
 */
export type HarnessSubagent = AgentControllerSubagent;
/**
 * @deprecated Renamed to `AgentControllerStateSchema`. Kept for backwards compatibility.
 */
export type HarnessStateSchema<T> = AgentControllerStateSchema<T>;
/**
 * @deprecated Renamed to `AgentControllerConfig`. Kept for backwards compatibility.
 */
export type HarnessConfig<TState = {}> = AgentControllerConfig<TState>;
/**
 * @deprecated Renamed to `AgentControllerOMConfig`. Kept for backwards compatibility.
 */
export type HarnessOMConfig = AgentControllerOMConfig;
/**
 * @deprecated Renamed to `AgentControllerThread`. Kept for backwards compatibility.
 */
export type HarnessThread = AgentControllerThread;
/**
 * @deprecated Renamed to `AgentControllerSubagentHistoryEntry`. Kept for backwards compatibility.
 */
export type HarnessSubagentHistoryEntry = AgentControllerSubagentHistoryEntry;
/**
 * @deprecated Renamed to `AgentControllerDisplayState`. Kept for backwards compatibility.
 */
export type HarnessDisplayState = AgentControllerDisplayState;
/**
 * @deprecated Renamed to `AgentControllerEvent`. Kept for backwards compatibility.
 */
export type HarnessEvent = AgentControllerEvent;
/**
 * @deprecated Renamed to `AgentControllerEventListener`. Kept for backwards compatibility.
 */
export type HarnessEventListener = AgentControllerEventListener;
/**
 * @deprecated Renamed to `AgentControllerMessage`. Kept for backwards compatibility.
 */
export type HarnessMessage = AgentControllerMessage;
/**
 * @deprecated Renamed to `AgentControllerMessageContent`. Kept for backwards compatibility.
 */
export type HarnessMessageContent = AgentControllerMessageContent;
/**
 * @deprecated Renamed to `AgentControllerRequestStateUpdateResult`. Kept for backwards compatibility.
 */
export type HarnessRequestStateUpdateResult<TState, TResult> = AgentControllerRequestStateUpdateResult<TState, TResult>;
/**
 * @deprecated Renamed to `AgentControllerRequestStateUpdater`. Kept for backwards compatibility.
 */
export type HarnessRequestStateUpdater<TState, TResult> = AgentControllerRequestStateUpdater<TState, TResult>;
/**
 * @deprecated Renamed to `AgentControllerRequestState`. Kept for backwards compatibility.
 */
export type HarnessRequestState<TState = unknown> = AgentControllerRequestState<TState>;
/**
 * @deprecated Renamed to `AgentControllerRequestSession`. Kept for backwards compatibility.
 */
export type HarnessRequestSession<TState = unknown> = AgentControllerRequestSession<TState>;
/**
 * @deprecated Renamed to `AgentControllerRequestContext`. Kept for backwards compatibility.
 */
export type HarnessRequestContext<TState = unknown> = AgentControllerRequestContext<TState>;
