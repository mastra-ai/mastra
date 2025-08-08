import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';

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
  stream: ReadableStream<LanguageModelV2StreamPart | Record<string, any>>;
  warnings: Record<string, any>;
  request: Record<string, any>;
  rawResponse?: Record<string, any>;
  response?: Record<string, any>;
}>;
