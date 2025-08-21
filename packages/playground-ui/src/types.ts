import type { AiMessageType } from '@mastra/core/memory';

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
  providerOptions?: Record<string, unknown>;
  chatWithGenerate?: boolean;
  chatWithGenerateVNext?: boolean;
  chatWithStreamVNext?: boolean;
}

export interface AgentSettingsType {
  modelSettings: ModelSettings;
}

export interface ChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  threadId?: string;
  initialMessages?: Message[];
  memory?: boolean;
  refreshThreadList?: () => void;
  settings?: AgentSettingsType;
  runtimeContext?: Record<string, any>;
  onInputChange?: (value: string) => void;
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

export * from './domains/traces/types';
