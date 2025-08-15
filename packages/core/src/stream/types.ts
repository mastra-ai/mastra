import type { LanguageModelV1StreamPart } from 'ai';
import type { StepResult } from 'ai-v5';

export type ChunkType = {
  type: string;
  runId: string;
  from: string;
  payload: Record<string, any>;
};

export type OnResult = (result: {
  warnings: Record<string, any>;
  request: Record<string, any>;
  rawResponse: Record<string, any>;
}) => void;

export type CreateStream = () => Promise<{
  stream: ReadableStream<LanguageModelV1StreamPart | Record<string, any>>;
  warnings: Record<string, any>;
  request: Record<string, any>;
  rawResponse?: Record<string, any>;
  response?: Record<string, any>;
}>;

export interface StepBufferItem {
  stepType: 'initial' | 'tool-result';
  text: string;
  reasoning?: string;
  sources: any[];
  files: any[];
  toolCalls: any[];
  toolResults: any[];
  warnings?: any[];
  reasoningDetails?: any;
  providerMetadata?: any;
  experimental_providerMetadata?: any;
  isContinued?: boolean;
  logprobs?: any;
  finishReason?: string;
  response?: any;
  request?: any;
  usage?: any;
  content: StepResult<any>['content'];
}

export interface BufferedByStep {
  text: string;
  reasoning: string;
  sources: any[];
  files: any[];
  toolCalls: any[];
  toolResults: any[];
  msgCount: number;
}
