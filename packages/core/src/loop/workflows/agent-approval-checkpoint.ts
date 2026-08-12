import type { ApprovalPersistenceMode } from '../../agent/approval-persistence';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import type { SerializedMastraModelOutputState } from '../../stream/base/output';
import type {
  AgentApprovalCheckpoint,
  AgentApprovalCheckpointApproval,
  WorkflowCheckpointJsonObject as JsonObject,
  WorkflowCheckpointJsonValue as JsonValue,
  WorkflowRunSnapshot,
  WorkflowRunState,
  WorkflowRunStatus,
} from '../../workflows/types';

export const AGENT_APPROVAL_CHECKPOINT_KIND = 'agent-approval-checkpoint' as const;
export const AGENT_APPROVAL_CHECKPOINT_VERSION = 1 as const;

const DURABLE_REHYDRATION_FIELDS = [
  '__workflowKind',
  'runId',
  'agentId',
  'agentName',
  'toolsMetadata',
  'modelConfig',
  'modelList',
  'scorers',
  'options',
  'state',
  'messageId',
  // Durable cold recovery currently uses these entries for tenant/FGA context.
  // The generic snapshot requestContext and tracing context remain excluded.
  'requestContextEntries',
] as const;

/** Returns whether a value is a non-array object suitable for checkpoint field inspection. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates an execution path encoded as an array of integer indices. */
function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'number' && Number.isInteger(entry));
}

/** Creates a consistently classified user-facing checkpoint error. */
function checkpointError(
  id: Uppercase<string>,
  text: string,
  details?: Record<string, null | boolean | number | string>,
): MastraError {
  return new MastraError({
    id,
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text,
    details,
  });
}

/** Clones selected persisted state through JSON, rejecting values storage cannot represent. */
function toJsonValue<T>(value: unknown, field: string): T {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error('value is not JSON representable');
    }
    return JSON.parse(serialized) as T;
  } catch (error) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_NOT_JSON_SAFE',
      `Cannot create an agent approval checkpoint: ${field} is not JSON-safe.`,
      { field, cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

/** Selects the JSON-safe durable-agent input fields required after a process restart. */
function selectRehydrationInput(input: unknown): JsonObject | undefined {
  if (!isRecord(input) || input.__workflowKind !== 'durable-agent') return undefined;

  const selected: Record<string, unknown> = {};
  for (const field of DURABLE_REHYDRATION_FIELDS) {
    if (input[field] !== undefined) selected[field] = input[field];
  }
  return toJsonValue<JsonObject>(selected, 'durable rehydration input');
}

/** Retains only the completed LLM step data required to continue the agent loop. */
function selectContinuationSteps(snapshot: WorkflowRunState): JsonObject | undefined {
  const llmExecution = snapshot.context['llm-execution'];
  if (!isRecord(llmExecution) || llmExecution.status !== 'success' || !isRecord(llmExecution.output)) {
    return undefined;
  }

  const iteration = { ...llmExecution.output };
  delete iteration.messages;
  if (isRecord(iteration.output)) {
    iteration.output = { ...iteration.output, steps: [] };
  }
  return toJsonValue<JsonObject>(
    { 'llm-execution': { status: 'success', output: iteration } },
    'approval continuation steps',
  );
}

/** Reconstructs the smallest serializer-compatible stream state needed by approval resume. */
function selectMinimalStreamState(value: unknown): SerializedMastraModelOutputState | undefined {
  if (!isRecord(value) || !isRecord(value.messageList)) return undefined;

  const toolCalls = Array.isArray(value.toolCalls)
    ? toJsonValue<SerializedMastraModelOutputState['toolCalls']>(value.toolCalls, 'stream tool calls')
    : [];
  const warnings = Array.isArray(value.warnings)
    ? toJsonValue<SerializedMastraModelOutputState['warnings']>(value.warnings, 'stream warnings')
    : [];
  const finishReason =
    typeof value.finishReason === 'string'
      ? toJsonValue<SerializedMastraModelOutputState['finishReason']>(value.finishReason, 'stream finish reason')
      : undefined;
  const request = isRecord(value.request)
    ? toJsonValue<SerializedMastraModelOutputState['request']>(value.request, 'stream request')
    : {};
  const usageCount = isRecord(value.usageCount)
    ? toJsonValue<SerializedMastraModelOutputState['usageCount']>(value.usageCount, 'stream usage')
    : { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  const tripwire = isRecord(value.tripwire)
    ? toJsonValue<SerializedMastraModelOutputState['tripwire']>(value.tripwire, 'stream tripwire')
    : undefined;
  const messageList = toJsonValue<SerializedMastraModelOutputState['messageList']>(
    value.messageList,
    'stream message list',
  );

  return {
    status: 'suspended',
    bufferedSteps: [],
    bufferedStepRequests: [],
    bufferedReasoningDetails: {},
    bufferedByStep: {
      text: '',
      reasoning: [],
      sources: [],
      files: [],
      toolCalls: [],
      toolResults: [],
      dynamicToolCalls: [],
      dynamicToolResults: [],
      staticToolCalls: [],
      staticToolResults: [],
      content: [],
      usage: {},
      warnings: [],
      request: {},
      response: { id: '', timestamp: new Date(0).toISOString(), modelId: '', messages: [], uiMessages: [] },
      reasoningText: '',
    },
    bufferedText: [],
    bufferedTextChunks: {},
    bufferedSources: [],
    bufferedReasoning: [],
    bufferedFiles: [],
    toolCallArgsDeltas: {},
    toolCallDeltaIdNameMap: {},
    toolCallStreamingMeta: {},
    toolCalls,
    toolResults: [],
    warnings,
    finishReason,
    request,
    usageCount,
    tripwire,
    wasSuspended: true,
    messageList,
  };
}

/** Removes unrelated suspension data while retaining approval and routing state. */
function selectSuspendPayload(payload: Record<string, unknown>): JsonObject {
  const selected: Record<string, unknown> = {};
  for (const field of ['requireToolApproval', '__agentId', 'suspendedToolRunId'] as const) {
    if (payload[field] !== undefined) selected[field] = payload[field];
  }
  const streamState = selectMinimalStreamState(payload.__streamState);
  if (streamState) selected.__streamState = streamState;

  if (isRecord(payload.__workflow_meta)) {
    const { foreachOutput: _foreachOutput, ...routingMetadata } = payload.__workflow_meta;
    if (Object.keys(routingMetadata).length > 0) selected.__workflow_meta = routingMetadata;
  }

  return toJsonValue<JsonObject>(selected, 'approval suspend payload');
}

/** Converts one suspended tool payload into a routed checkpoint approval entry. */
function approvalFromPayload(params: {
  payload: unknown;
  stepId: string;
  foreachIndex?: number;
  snapshot: WorkflowRunState;
}): AgentApprovalCheckpointApproval | undefined {
  if (!isRecord(params.payload) || !isRecord(params.payload.requireToolApproval)) return undefined;
  const approval = params.payload.requireToolApproval;
  if (typeof approval.toolCallId !== 'string' || typeof approval.toolName !== 'string') return undefined;

  const label = params.snapshot.resumeLabels[approval.toolCallId];
  const stepId = label?.stepId ?? params.stepId;
  const foreachIndex = label ? label.foreachIndex : params.foreachIndex;

  return {
    toolCallId: approval.toolCallId,
    toolName: approval.toolName,
    ...(approval.args === undefined ? {} : { args: toJsonValue<JsonValue>(approval.args, 'approval arguments') }),
    resumeLabel: approval.toolCallId,
    stepId,
    ...(foreachIndex === undefined ? {} : { foreachIndex }),
    executionPath: [...(params.snapshot.suspendedPaths[stepId] ?? [])],
    suspendPayload: selectSuspendPayload(params.payload),
  };
}

/** Collects pending approvals and status-only markers for completed foreach iterations. */
function collectApprovalState(snapshot: WorkflowRunState): {
  approvals: AgentApprovalCheckpointApproval[];
  completedForeachIndices: Record<string, number[]>;
} {
  const approvals: AgentApprovalCheckpointApproval[] = [];
  const completedForeachIndices: Record<string, number[]> = {};

  for (const [stepId, result] of Object.entries(snapshot.context)) {
    if (stepId === 'input' || !isRecord(result) || result.status !== 'suspended') continue;

    const direct = approvalFromPayload({ payload: result.suspendPayload, stepId, snapshot });

    const suspendPayload = result.suspendPayload;
    const metadata = isRecord(suspendPayload) ? suspendPayload.__workflow_meta : undefined;
    const foreachOutput = isRecord(metadata) ? metadata.foreachOutput : undefined;
    if (!isRecord(foreachOutput) && !Array.isArray(foreachOutput)) {
      if (direct) approvals.push(direct);
      continue;
    }

    const nestedApprovals: AgentApprovalCheckpointApproval[] = [];
    for (const [index, entry] of Object.entries(foreachOutput)) {
      if (!isRecord(entry)) continue;
      if (entry.status === 'success') {
        (completedForeachIndices[stepId] ??= []).push(Number(index));
        continue;
      }
      if (entry.status !== 'suspended') continue;
      const nested = approvalFromPayload({
        payload: entry.suspendPayload,
        stepId,
        foreachIndex: Number(index),
        snapshot,
      });
      if (nested) nestedApprovals.push(nested);
    }
    if (direct) {
      const duplicate = nestedApprovals.find(approval => approval.toolCallId === direct.toolCallId);
      if (!duplicate || duplicate.foreachIndex === undefined) {
        approvals.push(direct);
      }
    }
    approvals.push(
      ...nestedApprovals.filter(
        approval => approval.toolCallId !== direct?.toolCallId || approval.foreachIndex !== undefined,
      ),
    );
  }

  return { approvals, completedForeachIndices };
}

/** Builds the persisted checkpoint after approval state has already been collected. */
function buildAgentApprovalCheckpointFromState(params: {
  workflowId: string;
  snapshot: WorkflowRunState;
  approvals: AgentApprovalCheckpointApproval[];
  completedForeachIndices: Record<string, number[]>;
}): AgentApprovalCheckpoint {
  const input = selectRehydrationInput(params.snapshot.context.input);
  const continuationSteps = selectContinuationSteps(params.snapshot);
  return {
    kind: AGENT_APPROVAL_CHECKPOINT_KIND,
    version: AGENT_APPROVAL_CHECKPOINT_VERSION,
    workflowId: params.workflowId,
    runId: params.snapshot.runId,
    status: 'suspended',
    timestamp: params.snapshot.timestamp,
    approvals: params.approvals,
    routing: toJsonValue<AgentApprovalCheckpoint['routing']>(
      {
        activePaths: params.snapshot.activePaths,
        activeStepsPath: params.snapshot.activeStepsPath,
        suspendedPaths: params.snapshot.suspendedPaths,
        resumeLabels: params.snapshot.resumeLabels,
        waitingPaths: params.snapshot.waitingPaths,
        ...(Object.keys(params.completedForeachIndices).length > 0
          ? { completedForeachIndices: params.completedForeachIndices }
          : {}),
        ...(params.snapshot.stepExecutionPath ? { stepExecutionPath: params.snapshot.stepExecutionPath } : {}),
      },
      'workflow routing state',
    ),
    rehydration: {
      ...(input ? { input } : {}),
      ...(continuationSteps ? { steps: continuationSteps } : {}),
    },
  };
}

/**
 * Reduces a suspended agent-loop snapshot to the versioned approval-only
 * representation. This function is pure and does not select when persistence
 * should use the checkpoint; that integration belongs at the write boundary.
 */
export function buildAgentApprovalCheckpoint(params: {
  workflowId: string;
  snapshot: WorkflowRunState;
}): AgentApprovalCheckpoint {
  if (params.snapshot.status !== 'suspended') {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_NOT_SUSPENDED',
      'Cannot create an agent approval checkpoint: the workflow is not suspended.',
    );
  }

  const { approvals, completedForeachIndices } = collectApprovalState(params.snapshot);
  if (approvals.length === 0) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_APPROVAL_NOT_FOUND',
      'Cannot create an agent approval checkpoint: no pending tool approval was found.',
    );
  }

  return buildAgentApprovalCheckpointFromState({ ...params, approvals, completedForeachIndices });
}

/** Validates and detaches a persisted version-1 approval checkpoint. */
export function parseAgentApprovalCheckpoint(value: unknown): AgentApprovalCheckpoint {
  if (!isRecord(value) || value.kind !== AGENT_APPROVAL_CHECKPOINT_KIND) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_INVALID',
      'Invalid agent approval checkpoint: the checkpoint discriminator is missing.',
    );
  }
  if (value.version !== AGENT_APPROVAL_CHECKPOINT_VERSION) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_UNSUPPORTED_VERSION',
      `Unsupported agent approval checkpoint version "${String(value.version)}". Expected version ${AGENT_APPROVAL_CHECKPOINT_VERSION}.`,
      { version: String(value.version) },
    );
  }

  const valid =
    value.status === 'suspended' &&
    typeof value.workflowId === 'string' &&
    typeof value.runId === 'string' &&
    typeof value.timestamp === 'number' &&
    Array.isArray(value.approvals) &&
    value.approvals.length > 0 &&
    value.approvals.every(
      approval =>
        isRecord(approval) &&
        typeof approval.toolCallId === 'string' &&
        typeof approval.toolName === 'string' &&
        typeof approval.resumeLabel === 'string' &&
        typeof approval.stepId === 'string' &&
        isNumberArray(approval.executionPath) &&
        (approval.foreachIndex === undefined ||
          (typeof approval.foreachIndex === 'number' &&
            Number.isInteger(approval.foreachIndex) &&
            approval.foreachIndex >= 0)) &&
        isRecord(approval.suspendPayload),
    ) &&
    isRecord(value.routing) &&
    isNumberArray(value.routing.activePaths) &&
    isRecord(value.routing.activeStepsPath) &&
    Object.values(value.routing.activeStepsPath).every(isNumberArray) &&
    isRecord(value.routing.suspendedPaths) &&
    Object.values(value.routing.suspendedPaths).every(isNumberArray) &&
    isRecord(value.routing.resumeLabels) &&
    Object.values(value.routing.resumeLabels).every(
      label =>
        isRecord(label) &&
        typeof label.stepId === 'string' &&
        (label.foreachIndex === undefined ||
          (typeof label.foreachIndex === 'number' && Number.isInteger(label.foreachIndex) && label.foreachIndex >= 0)),
    ) &&
    isRecord(value.routing.waitingPaths) &&
    Object.values(value.routing.waitingPaths).every(isNumberArray) &&
    (value.routing.completedForeachIndices === undefined ||
      (isRecord(value.routing.completedForeachIndices) &&
        Object.values(value.routing.completedForeachIndices).every(isNumberArray))) &&
    (value.routing.stepExecutionPath === undefined ||
      (Array.isArray(value.routing.stepExecutionPath) &&
        value.routing.stepExecutionPath.every(entry => typeof entry === 'string'))) &&
    isRecord(value.rehydration) &&
    (value.rehydration.input === undefined || isRecord(value.rehydration.input)) &&
    (value.rehydration.steps === undefined || isRecord(value.rehydration.steps));

  if (!valid) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_INVALID',
      'Invalid agent approval checkpoint: expected a suspended checkpoint with workflow, run, routing, and approval data.',
    );
  }

  const routing = value.routing as Record<string, any>;
  const approvalsMatchRouting = (value.approvals as Array<Record<string, any>>).every(approval => {
    const label = routing.resumeLabels[approval.resumeLabel];
    return (
      isRecord(label) &&
      label.stepId === approval.stepId &&
      label.foreachIndex === approval.foreachIndex &&
      isNumberArray(routing.suspendedPaths[approval.stepId])
    );
  });
  if (!approvalsMatchRouting) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_INVALID_ROUTING',
      'Invalid agent approval checkpoint: approval labels do not match the suspended workflow routing state.',
    );
  }

  return toJsonValue<AgentApprovalCheckpoint>(value, 'checkpoint');
}

/** Identifies the checkpoint representation without performing full schema validation. */
export function isAgentApprovalCheckpoint(value: unknown): value is AgentApprovalCheckpoint {
  return isRecord(value) && value.kind === AGENT_APPROVAL_CHECKPOINT_KIND;
}

/** Recreates the tool-call input consumed by the workflow foreach step. */
function approvalInput(approval: AgentApprovalCheckpointApproval): JsonObject {
  return {
    toolCallId: approval.toolCallId,
    toolName: approval.toolName,
    ...(approval.args === undefined ? {} : { args: approval.args }),
  };
}

/**
 * Reconstructs the narrow `WorkflowRunState` consumed by the existing resume
 * engine. Completed history is intentionally absent; only suspended entries
 * and their routing are recreated.
 */
export function materializeAgentApprovalCheckpoint(
  value: unknown,
  expected?: { workflowId?: string; runId?: string },
): WorkflowRunState {
  const checkpoint = parseAgentApprovalCheckpoint(value);
  if (
    (expected?.workflowId !== undefined && checkpoint.workflowId !== expected.workflowId) ||
    (expected?.runId !== undefined && checkpoint.runId !== expected.runId)
  ) {
    throw checkpointError(
      'AGENT_APPROVAL_CHECKPOINT_IDENTITY_MISMATCH',
      'Invalid agent approval checkpoint: persisted workflow or run identity does not match the requested run.',
      {
        expectedWorkflowId: expected?.workflowId ?? '',
        actualWorkflowId: checkpoint.workflowId,
        expectedRunId: expected?.runId ?? '',
        actualRunId: checkpoint.runId,
      },
    );
  }
  const context: WorkflowRunState['context'] = {};
  if (checkpoint.rehydration.input) {
    const input = { ...checkpoint.rehydration.input } as Record<string, any>;
    if (input.__workflowKind === 'durable-agent' && input.messageListState === undefined) {
      const streamState = checkpoint.approvals.find(approval => isRecord(approval.suspendPayload.__streamState))
        ?.suspendPayload.__streamState;
      if (isRecord(streamState) && isRecord(streamState.messageList)) {
        input.messageListState = streamState.messageList;
      }
    }
    context.input = input;
  }
  if (checkpoint.rehydration.steps) {
    Object.assign(context, checkpoint.rehydration.steps);
  }

  const byStep = new Map<string, AgentApprovalCheckpointApproval[]>();
  for (const approval of checkpoint.approvals) {
    const approvals = byStep.get(approval.stepId) ?? [];
    approvals.push(approval);
    byStep.set(approval.stepId, approvals);
  }

  for (const [stepId, approvals] of byStep) {
    const first = approvals[0]!;
    const indexed = approvals.filter(approval => approval.foreachIndex !== undefined);
    let suspendPayload = toJsonValue<Record<string, any>>(first.suspendPayload, 'approval suspend payload');
    let payload: unknown = approvalInput(first);

    if (indexed.length > 0) {
      const completedIndices = checkpoint.routing.completedForeachIndices?.[stepId] ?? [];
      const maxIndex = Math.max(...indexed.map(approval => approval.foreachIndex!), ...completedIndices);
      const foreachOutput = Array.from({ length: maxIndex + 1 }, () => null) as any[];
      const foreachInput = Array.from({ length: maxIndex + 1 }, () => null) as unknown[];
      for (const index of completedIndices) {
        foreachOutput[index] = { status: 'success' };
      }
      for (const approval of indexed) {
        const index = approval.foreachIndex!;
        const input = approvalInput(approval);
        foreachInput[index] = input;
        foreachOutput[index] = {
          status: 'suspended',
          payload: input,
          suspendPayload: approval.suspendPayload,
          suspendedAt: checkpoint.timestamp,
        };
      }
      suspendPayload = {
        ...suspendPayload,
        __workflow_meta: {
          ...(isRecord(suspendPayload.__workflow_meta) ? suspendPayload.__workflow_meta : {}),
          foreachOutput,
        },
      };
      payload = foreachInput;
    }

    context[stepId] = {
      status: 'suspended',
      payload,
      suspendPayload,
      suspendedAt: checkpoint.timestamp,
    } as any;
  }

  const requestContext = checkpoint.rehydration.input?.requestContextEntries;
  return {
    runId: checkpoint.runId,
    status: 'suspended',
    value: {},
    context,
    serializedStepGraph: [],
    activePaths: [...checkpoint.routing.activePaths],
    activeStepsPath: toJsonValue<Record<string, number[]>>(checkpoint.routing.activeStepsPath, 'active step paths'),
    suspendedPaths: toJsonValue<Record<string, number[]>>(checkpoint.routing.suspendedPaths, 'suspended paths'),
    resumeLabels: toJsonValue<WorkflowRunState['resumeLabels']>(checkpoint.routing.resumeLabels, 'resume labels'),
    waitingPaths: toJsonValue<Record<string, number[]>>(checkpoint.routing.waitingPaths, 'waiting paths'),
    timestamp: checkpoint.timestamp,
    ...(checkpoint.routing.stepExecutionPath ? { stepExecutionPath: [...checkpoint.routing.stepExecutionPath] } : {}),
    ...(isRecord(requestContext)
      ? { requestContext: toJsonValue<Record<string, any>>(requestContext, 'request context') }
      : {}),
  };
}

/**
 * Creates the internal representation selector used by agent workflows. Full
 * persistence remains unchanged; minimal persistence applies only to a
 * suspended snapshot that actually contains a pending approval.
 */
export function createAgentApprovalSnapshotPersistence(params: {
  workflowId: string;
  approvalPersistence: ApprovalPersistenceMode | ((snapshot: WorkflowRunState) => ApprovalPersistenceMode | undefined);
}): (input: { snapshot: WorkflowRunState; workflowStatus: WorkflowRunStatus }) => WorkflowRunSnapshot {
  return ({ snapshot, workflowStatus }) => {
    const mode =
      typeof params.approvalPersistence === 'function'
        ? params.approvalPersistence(snapshot)
        : params.approvalPersistence;
    if (mode !== 'minimal' || workflowStatus !== 'suspended') {
      return snapshot;
    }
    const approvalState = collectApprovalState(snapshot);
    if (approvalState.approvals.length === 0) return snapshot;
    return buildAgentApprovalCheckpointFromState({ workflowId: params.workflowId, snapshot, ...approvalState });
  };
}

/** Materializes approval checkpoints for related workflow rows, including stores that return JSON strings. */
export async function materializePersistedAgentApprovalCheckpoints(params: {
  workflowsStore: WorkflowsStorage;
  workflowNames: readonly string[];
  outerWorkflowName: string;
  runId: string;
}): Promise<WorkflowRunState | undefined> {
  let outerSnapshot: WorkflowRunState | undefined;
  for (const workflowName of params.workflowNames) {
    const run = await params.workflowsStore.getWorkflowRunById({ workflowName, runId: params.runId });
    if (!run?.snapshot) continue;
    let persisted: unknown = run.snapshot;
    if (typeof persisted === 'string') {
      try {
        persisted = JSON.parse(persisted);
      } catch {
        continue;
      }
    }
    if (!isAgentApprovalCheckpoint(persisted)) continue;

    const materialized = materializeAgentApprovalCheckpoint(persisted, {
      workflowId: workflowName,
      runId: params.runId,
    });
    await params.workflowsStore.persistWorkflowSnapshot({
      workflowName,
      runId: params.runId,
      resourceId: run.resourceId,
      snapshot: materialized,
      createdAt: run.createdAt,
    });
    if (workflowName === params.outerWorkflowName) outerSnapshot = materialized;
  }
  return outerSnapshot;
}

/** Reads the serialized per-run option used by reusable durable workflows. */
export function getApprovalPersistenceFromSnapshot(snapshot: WorkflowRunState): ApprovalPersistenceMode {
  const input = snapshot.context.input;
  const options = isRecord(input) ? input.options : undefined;
  return isRecord(options) && options.approvalPersistence === 'minimal' ? 'minimal' : 'full';
}
