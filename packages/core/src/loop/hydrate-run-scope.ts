/**
 * Copy non-undefined fields from a {@link StreamInternal} bag into the per-run
 * `RunScope` on `Mastra`. Called once by `workflowLoopStream` *after*
 * `__registerInternalWorkflow` has allocated the scope, so it does not touch
 * the scope's refcount.
 *
 * Step factories read through the scope in production. They still accept the
 * legacy `_internal` argument so tests that construct factories directly
 * (without going through `loop()`) keep working via the fallback path in
 * `run-scope-access.ts`.
 */

import type { Mastra } from '../mastra';
import {
  AGENT_KEY,
  AGENT_BACKGROUND_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_KEY,
  CURRENT_DATE_KEY,
  DRAIN_PENDING_SIGNALS_KEY,
  GENERATE_ID_KEY,
  INITIAL_SIGNAL_ECHOES_KEY,
  MEMORY_CONFIG_KEY,
  MEMORY_KEY,
  NOW_KEY,
  RESOURCE_ID_KEY,
  SAVE_QUEUE_MANAGER_KEY,
  SKIP_BG_TASK_WAIT_KEY,
  THREAD_EXISTS_KEY,
  THREAD_ID_KEY,
  TOOL_PAYLOAD_TRANSFORM_KEY,
  TRANSPORT_REF_KEY,
} from './run-scope-keys';
import type { StreamInternal } from './types';

export function hydrateRunScopeFromInternal(mastra: Mastra, runId: string, internal: StreamInternal | undefined): void {
  if (!internal) return;
  const scope = mastra.__getRunScope(runId);
  if (!scope) return;

  // Intentionally NOT hydrated here: `stepTools`, `stepActiveTools`,
  // `stepWorkspace`, `_delegationBailed`. Those are *runtime-written outputs*
  // of step execution, not bootstrap inputs — hydrating them would seed the
  // scope with stale/empty values that get overwritten on the first step.
  // The one case where a caller pre-populates `_internal.stepTools` as a
  // bootstrap input (durable resume via `resolveInternalState`, e.g. the
  // `ToolSearchProcessor` pattern) still works because `readScoped` falls
  // back to `_internal[field]` when the scope slot is `undefined`.
  if (internal.agent) scope.set(AGENT_KEY, internal.agent);
  if (internal.now) scope.set(NOW_KEY, internal.now);
  if (internal.generateId) scope.set(GENERATE_ID_KEY, internal.generateId);
  if (internal.currentDate) scope.set(CURRENT_DATE_KEY, internal.currentDate);
  if (internal.saveQueueManager) scope.set(SAVE_QUEUE_MANAGER_KEY, internal.saveQueueManager);
  if (internal.memoryConfig) scope.set(MEMORY_CONFIG_KEY, internal.memoryConfig);
  if (internal.threadId !== undefined) scope.set(THREAD_ID_KEY, internal.threadId);
  if (internal.resourceId !== undefined) scope.set(RESOURCE_ID_KEY, internal.resourceId);
  if (internal.memory) scope.set(MEMORY_KEY, internal.memory);
  if (internal.threadExists !== undefined) scope.set(THREAD_EXISTS_KEY, internal.threadExists);
  if (internal.transportRef) scope.set(TRANSPORT_REF_KEY, internal.transportRef);
  if (internal.backgroundTaskManager) scope.set(BACKGROUND_TASK_MANAGER_KEY, internal.backgroundTaskManager);
  if (internal.agentBackgroundConfig) scope.set(AGENT_BACKGROUND_CONFIG_KEY, internal.agentBackgroundConfig);
  if (internal.backgroundTaskManagerConfig)
    scope.set(BACKGROUND_TASK_MANAGER_CONFIG_KEY, internal.backgroundTaskManagerConfig);
  if (internal.skipBgTaskWait !== undefined) scope.set(SKIP_BG_TASK_WAIT_KEY, internal.skipBgTaskWait);
  if (internal.drainPendingSignals) scope.set(DRAIN_PENDING_SIGNALS_KEY, internal.drainPendingSignals);
  if (internal.initialSignalEchoes) scope.set(INITIAL_SIGNAL_ECHOES_KEY, internal.initialSignalEchoes);
  if (internal.toolPayloadTransform) scope.set(TOOL_PAYLOAD_TRANSFORM_KEY, internal.toolPayloadTransform);
}
