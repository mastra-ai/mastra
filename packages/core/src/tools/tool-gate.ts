import type { RequestContext } from '../request-context';
import type { CoreTool, MCPToolProperties, McpMetadata } from './types';

export type ToolGateBoundary = 'model-input' | 'tool-call' | 'dynamic-search' | 'dynamic-load';

export type ToolGateSource =
  | { source: 'assigned' }
  | { source: 'client' }
  | { source: 'toolset'; toolsetName?: string }
  | { source: 'dynamic'; catalogName?: string; loaded?: boolean }
  | { source: 'provider'; providerToolId: string; providerName?: string; modelFacingName?: string }
  | { source: 'mcp'; serverName?: string; serverVersion?: string; toolType?: MCPToolProperties['toolType'] }
  | { source: 'agent'; primitiveId: string }
  | { source: 'workflow'; primitiveId: string }
  | { source: 'memory' }
  | { source: 'workspace' }
  | { source: 'skill'; skillId?: string }
  | { source: 'browser' }
  | { source: 'channel'; channelId?: string }
  | { source: 'unknown' };

export type ToolGateSubject = {
  boundary: ToolGateBoundary;
  toolName: string;
  toolId?: string;
  description?: string;
  source: ToolGateSource;
  mcp?: {
    metadata?: McpMetadata;
    annotations?: MCPToolProperties['annotations'];
  };
  provider?: {
    id: string;
    args?: Record<string, unknown>;
  };
};

export type ToolGateEffect = 'allow' | 'deny' | 'requireApproval';

export type ToolGateDecision = {
  effect: ToolGateEffect;
  reason: string;
  ruleId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type ToolGateDecisionRecord = ToolGateDecision & {
  subject: ToolGateSubject;
  policyId?: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  toolCallId?: string;
  evaluatedAt: string;
};

export type ToolGateEvaluation = {
  subject: ToolGateSubject;
  requestContext?: RequestContext;
  args?: unknown;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  toolCallId?: string;
};

export type ToolGateEvaluator = (evaluation: ToolGateEvaluation) => ToolGateDecision | Promise<ToolGateDecision>;

export type ToolGatePolicy = {
  id: string;
  description?: string;
  evaluate: ToolGateEvaluator;
};

export type ToolGateResumeRule = 'original-policy-only' | 'narrow-on-resume';

export type ToolGateSerializableState = {
  policyId?: string;
  policyRevision?: string;
  resumeRule?: ToolGateResumeRule;
  decisions?: ToolGateDecisionRecord[];
};

export type ToolGateRuntimeState = {
  policyId?: string;
  policy?: ToolGatePolicy;
  policyRevision?: string;
  resumeRule?: ToolGateResumeRule;
  decisions?: ToolGateDecisionRecord[];
};

const toolGateRuntimeState = new WeakMap<RequestContext, ToolGateRuntimeState>();

function copyToolGateRecord(record: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!record) return undefined;

  const copied: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    copied[key] = copyToolGateValue(value);
  }

  return copied;
}

function copyToolGateValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const copied: unknown[] = [];
    seen.set(value, copied);
    for (const item of value) {
      copied.push(copyToolGateValue(item, seen));
    }
    return copied;
  }

  const copied: Record<string, unknown> = {};
  seen.set(value, copied);
  for (const [key, item] of Object.entries(value)) {
    copied[key] = copyToolGateValue(item, seen);
  }

  return copied;
}

function copyDecisionRecord(record: ToolGateDecisionRecord): ToolGateDecisionRecord {
  return {
    ...record,
    subject: {
      ...record.subject,
      source: { ...record.subject.source },
      mcp: record.subject.mcp
        ? {
            metadata: record.subject.mcp.metadata ? { ...record.subject.mcp.metadata } : undefined,
            annotations: record.subject.mcp.annotations ? { ...record.subject.mcp.annotations } : undefined,
          }
        : undefined,
      provider: record.subject.provider
        ? {
            ...record.subject.provider,
            args: copyToolGateRecord(record.subject.provider.args),
          }
        : undefined,
    },
    metadata: copyToolGateRecord(record.metadata),
  };
}

function copySerializableRecord(record: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!record) return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const copied = copySerializableToolGateValue(value);
    if (copied !== undefined) {
      result[key] = copied;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function copySerializableToolGateValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value !== 'object') return undefined;
  if (seen.has(value)) return undefined;

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map(item => {
      const copied = copySerializableToolGateValue(item, seen);
      return copied === undefined ? null : copied;
    });
    seen.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const copied = copySerializableToolGateValue(item, seen);
    if (copied !== undefined) {
      result[key] = copied;
    }
  }

  seen.delete(value);
  return Object.keys(result).length > 0 ? result : undefined;
}

function copySerializableDecisionRecord(record: ToolGateDecisionRecord): ToolGateDecisionRecord {
  const copied = copyDecisionRecord(record);

  return {
    ...copied,
    metadata: copySerializableRecord(copied.metadata),
    subject: {
      ...copied.subject,
      provider: copied.subject.provider
        ? {
            ...copied.subject.provider,
            args: copySerializableRecord(copied.subject.provider.args),
          }
        : undefined,
    },
  };
}

function providerNameFromId(providerToolId: string): string | undefined {
  const [providerName] = providerToolId.split('.');
  return providerName || undefined;
}

function modelFacingNameFromProviderId(providerToolId: string): string | undefined {
  const [, ...nameParts] = providerToolId.split('.');
  return nameParts.length > 0 ? nameParts.join('.') : undefined;
}

export function createToolGateSubject({
  boundary,
  toolName,
  tool,
  source,
}: {
  boundary: ToolGateBoundary;
  toolName: string;
  tool?: Partial<CoreTool> & { mcpMetadata?: McpMetadata };
  source: ToolGateSource;
}): ToolGateSubject {
  const toolId = typeof tool?.id === 'string' ? tool.id : undefined;
  const provider =
    source.source === 'provider'
      ? {
          id: source.providerToolId,
          args:
            tool && 'args' in tool && typeof tool.args === 'object' && tool.args !== null
              ? ({ ...(tool.args as Record<string, unknown>) } as Record<string, unknown>)
              : undefined,
        }
      : undefined;

  return {
    boundary,
    toolName,
    toolId,
    description: typeof tool?.description === 'string' ? tool.description : undefined,
    source,
    ...(tool?.mcp || tool?.mcpMetadata
      ? {
          mcp: {
            metadata: tool.mcpMetadata,
            annotations: tool.mcp?.annotations,
          },
        }
      : {}),
    ...(provider ? { provider } : {}),
  };
}

export function createProviderToolGateSubject({
  boundary,
  toolName,
  tool,
}: {
  boundary: ToolGateBoundary;
  toolName: string;
  tool: Partial<CoreTool> & { id: string };
}): ToolGateSubject {
  const providerToolId = tool.id;
  const providerToolName = 'name' in tool && typeof tool.name === 'string' ? tool.name : undefined;

  return createToolGateSubject({
    boundary,
    toolName,
    tool,
    source: {
      source: 'provider',
      providerToolId,
      providerName: providerNameFromId(providerToolId),
      modelFacingName: providerToolName ?? modelFacingNameFromProviderId(providerToolId),
    },
  });
}

export function createToolGateDecisionRecord({
  decision,
  subject,
  policyId,
  runId,
  threadId,
  resourceId,
  toolCallId,
  evaluatedAt = new Date().toISOString(),
}: {
  decision: ToolGateDecision;
  subject: ToolGateSubject;
  policyId?: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  toolCallId?: string;
  evaluatedAt?: string;
}): ToolGateDecisionRecord {
  return {
    ...decision,
    subject,
    policyId,
    runId,
    threadId,
    resourceId,
    toolCallId,
    evaluatedAt,
  };
}

export async function evaluateToolGatePolicy({
  policy,
  evaluation,
  evaluatedAt,
}: {
  policy: ToolGatePolicy;
  evaluation: ToolGateEvaluation;
  evaluatedAt?: string;
}): Promise<ToolGateDecisionRecord> {
  const decision = await policy.evaluate(evaluation);

  return createToolGateDecisionRecord({
    decision,
    subject: evaluation.subject,
    policyId: policy.id,
    runId: evaluation.runId,
    threadId: evaluation.threadId,
    resourceId: evaluation.resourceId,
    toolCallId: evaluation.toolCallId,
    evaluatedAt,
  });
}

export function setToolGateRuntimeState(requestContext: RequestContext, state: ToolGateRuntimeState): void {
  if (state.policyId && state.policy?.id && state.policyId !== state.policy.id) {
    throw new Error(
      `Tool Gate policyId mismatch: state policyId "${state.policyId}" does not match policy id "${state.policy.id}".`,
    );
  }

  toolGateRuntimeState.set(requestContext, {
    ...state,
    policyId: state.policy?.id ?? state.policyId,
    decisions: state.decisions?.map(copyDecisionRecord),
  });
}

export function getToolGateRuntimeState(requestContext: RequestContext): ToolGateRuntimeState | undefined {
  const state = toolGateRuntimeState.get(requestContext);
  if (!state) return undefined;

  return {
    ...state,
    decisions: state.decisions?.map(copyDecisionRecord),
  };
}

export function clearToolGateRuntimeState(requestContext: RequestContext): void {
  toolGateRuntimeState.delete(requestContext);
}

export function appendToolGateDecision(requestContext: RequestContext, record: ToolGateDecisionRecord): void {
  const state = toolGateRuntimeState.get(requestContext) ?? {};
  const decisions = state.decisions ? [...state.decisions, copyDecisionRecord(record)] : [copyDecisionRecord(record)];

  toolGateRuntimeState.set(requestContext, {
    ...state,
    decisions,
  });
}

export function serializeToolGateRuntimeState(
  state: ToolGateRuntimeState | undefined,
): ToolGateSerializableState | undefined {
  if (!state) return undefined;
  const policyId = state.policy?.id ?? state.policyId;

  return {
    policyId,
    policyRevision: state.policyRevision,
    resumeRule: state.resumeRule,
    decisions: state.decisions?.map(copySerializableDecisionRecord),
  };
}

export function hydrateToolGateRuntimeState({
  serialized,
  policy,
}: {
  serialized?: ToolGateSerializableState;
  policy?: ToolGatePolicy;
}): ToolGateRuntimeState | undefined {
  if (!serialized && !policy) return undefined;
  if (serialized?.policyId && policy?.id && serialized.policyId !== policy.id) {
    throw new Error(
      `Tool Gate policyId mismatch: serialized policyId "${serialized.policyId}" does not match provided policy id "${policy.id}".`,
    );
  }

  return {
    policyId: serialized?.policyId ?? policy?.id,
    policy,
    policyRevision: serialized?.policyRevision,
    resumeRule: serialized?.resumeRule,
    decisions: serialized?.decisions?.map(copyDecisionRecord),
  };
}
