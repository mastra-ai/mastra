import { GetAgentResponse } from '@mastra/client-js';
import type { AiMessageType } from '@mastra/core/memory';
import type { LLMStepResult } from '@mastra/core/agent';
import { MastraUIMessage } from '@mastra/react';
import type { UIMessageWithMetadata } from '@mastra/client-js';

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
  instructions?: string;
  providerOptions?: LLMStepResult['providerMetadata'];
  chatWithGenerateLegacy?: boolean;
  chatWithGenerate?: boolean;
  chatWithNetwork?: boolean;
  requireToolApproval?: boolean;
}

export interface AgentSettingsType {
  modelSettings: ModelSettings;
}

export interface ChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  threadId?: string;
  initialMessages?: MastraUIMessage[];
  initialLegacyMessages?: UIMessageWithMetadata[];
  memory?: boolean;
  refreshThreadList?: () => void;
  settings?: AgentSettingsType;
  runtimeContext?: Record<string, any>;
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

export * from './domains/traces/types';
