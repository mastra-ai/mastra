import type { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { GetAgentResponse, VersionOverrides } from '@mastra/client-js';
import type { LLMStepResult } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { AiMessageType } from '@mastra/core/memory';

/**
 * Local alias for the AI SDK v5 UIMessage shape that `toAISdkV5Messages` produces.
 *
 * The playground bridges `MastraDBMessage` -> AI SDK v5 UIMessage (this type)
 * -> assistant-ui ThreadMessageLike. Components that consume the AI-SDK shape
 * after `toAISdkV5Messages` should use this alias; components that consume
 * `useChat().messages` directly should use `MastraDBMessage`.
 *
 * Carries the playground-specific stream metadata (mode, approval/suspension,
 * background task, network, status, tripwire) the runtime stamps onto messages.
 */
export type AISdkUIMessageMetadata = {
  mode?: 'generate' | 'stream' | 'network';
  status?: 'warning' | 'error' | 'tripwire';
  [key: string]: unknown;
};

export type AISdkUIMessage = ReturnType<typeof toAISdkV5Messages>[number] & {
  metadata?: AISdkUIMessageMetadata;
};

export type Message = AiMessageType;

export interface AssistantMessage {
  id: string;
  formattedMessageId: string;
  finalStepId: string;
  routingDecision?: {
    resourceId: string;
    resourceType: string;
    selectionReason: string;
    prompt: string;
  };
  finalResponse: string;
  taskCompleteDecision?: {
    isComplete: boolean;
    finalResult: string;
    completionReason: string;
  };
}

export type ReadonlyJSONValue = null | string | number | boolean | ReadonlyJSONObject | ReadonlyJSONArray;

export type ReadonlyJSONObject = {
  readonly [key: string]: ReadonlyJSONValue;
};

export type ReadonlyJSONArray = readonly ReadonlyJSONValue[];

export interface ModelSettings {
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  maxSteps?: number;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  seed?: number;
  providerOptions?: LLMStepResult['providerMetadata'];
  chatWithGenerateLegacy?: boolean;
  chatWithGenerate?: boolean;
  chatWithLegacyStream?: boolean;
  chatWithNetwork?: boolean;
  requireToolApproval?: boolean;
}

export interface AgentSettingsType {
  modelSettings: ModelSettings;
}

export type AgentRunVersionSelectorErrorCode =
  | 'INVALID_VERSION_SELECTOR'
  | 'ENTITY_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'LABEL_NOT_FOUND'
  | 'VERSION_LABEL_INTEGRITY_ERROR'
  | 'VERSION_LABELS_UNSUPPORTED';

export interface ChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  /** Canonical selectors used only when starting a new run. */
  versions?: VersionOverrides;
  /** Whether Studio has a valid explicit selector for the next new run. */
  canStartRun?: boolean;
  runBlockedReason?: string;
  /** Whether an already-active signal-stream run may accept another user turn. */
  canContinueRun?: boolean;
  continuationBlockedReason?: string;
  /** Reports a stable selector failure so the caller can fail the next run closed. */
  onRunVersionSelectorError?: (code: AgentRunVersionSelectorErrorCode) => void;
  /** Reports a live authorization rejection so cached access can be refreshed and failed closed. */
  onRunAuthorizationError?: () => void;
  agentVersionId?: string;
  supportsMemory?: boolean;
  threadId: string;
  initialMessages?: MastraDBMessage[];
  refreshThreadList?: () => void;
  settings?: AgentSettingsType;
  requestContext?: Record<string, any>;
  onInputChange?: (value: string) => void;
  modelList?: GetAgentResponse['modelList'];
}

export type SpanStatus = {
  code: number;
};

export type SpanOther = {
  droppedAttributesCount: number;
  droppedEventsCount: number;
  droppedLinksCount: number;
};

export type SpanEvent = {
  attributes: Record<string, string | number | boolean | null>[];
  name: string;
  timeUnixNano: string;
  droppedAttributesCount: number;
};

export type Span = {
  id: string;
  parentSpanId: string | null;
  traceId: string;
  name: string;
  scope: string;
  kind: number;
  status: SpanStatus;
  events: SpanEvent[];
  links: any[]; // You might want to type this more specifically if you have link structure
  attributes: Record<string, string | number | boolean | null>;
  startTime: number;
  endTime: number;
  duration: number;
  other: SpanOther;
  createdAt: string;
};

export type RefinedTrace = {
  traceId: string;
  serviceName: string;
  duration: number;
  started: number;
  status: SpanStatus;
  trace: Span[];
  runId?: string;
};

export type StreamChunk = {
  type: string;
  payload: any;
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
};
