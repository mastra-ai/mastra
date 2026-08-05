/**
 * Typed {@link RunScopeKey} registry for the agentic loop + execution workflows.
 *
 * The agentic engine runs as evented workflow steps. Step input/output schemas
 * cross the wire (storage snapshots, `UnixSocketPubSub` frames), so they MUST
 * stay JSON-safe — see `serialization-invariants.test.ts`. Non-serializable
 * runtime state (live class instances, function closures, abort controllers,
 * stream transports) lives on the per-run `RunScope` held by `Mastra` instead.
 *
 * Each key here mirrors one slot on the legacy `StreamInternal` (`_internal`)
 * bag. During the migration, `loop.ts` hydrates the scope from `_internal`
 * before any step runs; step factories then prefer `scope.get(KEY)` and fall
 * back to `_internal` for the rare test path that constructs a step factory
 * directly without going through `loop()`.
 */

import type { IdGenerator, ToolSet } from '@internal/ai-sdk-v5';
import type { Agent } from '../agent/agent';
import type { SaveQueueManager } from '../agent/save-queue';
import type { CreatedAgentSignal } from '../agent/signals';
import type { AgentBackgroundConfig, BackgroundTaskManager, BackgroundTaskManagerConfig } from '../background-tasks';
import { createRunScopeKey } from '../mastra/run-scope';
import type { MastraMemory, MemoryConfigInternal } from '../memory';
import type { StreamTransportRef } from '../stream/types';
import type { ToolPayloadTransformPolicy } from '../tools';
import type { Workspace } from '../workspace/workspace';

// --- Identity / clock injectors --------------------------------------------

export const AGENT_KEY = createRunScopeKey<Agent<any, any, any, any>>('loop:agent');
export const NOW_KEY = createRunScopeKey<() => number>('loop:now');
export const GENERATE_ID_KEY = createRunScopeKey<IdGenerator>('loop:generateId');
export const CURRENT_DATE_KEY = createRunScopeKey<() => Date>('loop:currentDate');

// --- Persistence / memory ---------------------------------------------------

export const SAVE_QUEUE_MANAGER_KEY = createRunScopeKey<SaveQueueManager>('loop:saveQueueManager');
export const MEMORY_KEY = createRunScopeKey<MastraMemory>('loop:memory');
export const MEMORY_CONFIG_KEY = createRunScopeKey<MemoryConfigInternal>('loop:memoryConfig');
export const THREAD_ID_KEY = createRunScopeKey<string>('loop:threadId');
export const RESOURCE_ID_KEY = createRunScopeKey<string>('loop:resourceId');
export const THREAD_EXISTS_KEY = createRunScopeKey<boolean>('loop:threadExists');

// --- Step-local tool/workspace mutations -----------------------------------

export const STEP_TOOLS_KEY = createRunScopeKey<ToolSet>('loop:stepTools');
export const STEP_ACTIVE_TOOLS_KEY = createRunScopeKey<string[]>('loop:stepActiveTools');
export const STEP_WORKSPACE_KEY = createRunScopeKey<Workspace>('loop:stepWorkspace');

// --- Delegation / bail flags -----------------------------------------------

export const DELEGATION_BAILED_KEY = createRunScopeKey<boolean>('loop:delegationBailed');

// --- Stream transport / background tasks -----------------------------------

export const TRANSPORT_REF_KEY = createRunScopeKey<StreamTransportRef>('loop:transportRef');
export const BACKGROUND_TASK_MANAGER_KEY = createRunScopeKey<BackgroundTaskManager>('loop:backgroundTaskManager');
export const AGENT_BACKGROUND_CONFIG_KEY = createRunScopeKey<AgentBackgroundConfig>('loop:agentBackgroundConfig');
export const BACKGROUND_TASK_MANAGER_CONFIG_KEY = createRunScopeKey<BackgroundTaskManagerConfig>(
  'loop:backgroundTaskManagerConfig',
);
export const SKIP_BG_TASK_WAIT_KEY = createRunScopeKey<boolean>('loop:skipBgTaskWait');

// --- Signal drain / echoes -------------------------------------------------

export const DRAIN_PENDING_SIGNALS_KEY =
  createRunScopeKey<(runId: string, scope?: 'pending' | 'pre-run') => CreatedAgentSignal[]>('loop:drainPendingSignals');
export const INITIAL_SIGNAL_ECHOES_KEY = createRunScopeKey<CreatedAgentSignal[]>('loop:initialSignalEchoes');

// --- Tool payload transform ------------------------------------------------

export const TOOL_PAYLOAD_TRANSFORM_KEY = createRunScopeKey<ToolPayloadTransformPolicy>('loop:toolPayloadTransform');
