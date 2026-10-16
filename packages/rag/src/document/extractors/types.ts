import type { MastraLanguageModel } from '@mastra/core/agent';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { z } from 'zod';
import type {
  KeywordExtractPrompt,
  QuestionExtractPrompt,
  SummaryPrompt,
  TitleExtractorPrompt,
  TitleCombinePrompt,
} from '../prompts';

export type KeywordExtractArgs = {
  llm?: MastraLanguageModel;
  keywords?: number;
  promptTemplate?: KeywordExtractPrompt['template'];
};

export type QuestionAnswerExtractArgs = {
  llm?: MastraLanguageModel;
  questions?: number;
  promptTemplate?: QuestionExtractPrompt['template'];
  embeddingOnly?: boolean;
};

export type SummaryExtractArgs = {
  llm?: MastraLanguageModel;
  summaries?: string[];
  promptTemplate?: SummaryPrompt['template'];
};

export type TitleExtractorsArgs = {
  llm?: MastraLanguageModel;
  nodes?: number;
  nodeTemplate?: TitleExtractorPrompt['template'];
  combineTemplate?: TitleCombinePrompt['template'];
};

export type SchemaExtractArgs<T extends z.ZodType = z.ZodType> = {
  schema: T;
  llm?: MastraLanguageModel;
  instructions?: string;
  metadataKey?: string;
};

export const STRIP_REGEX = /(\r\n|\n|\r)/gm;

export const baseLLM: MastraLanguageModel = new ModelRouterLanguageModel('openai/gpt-4o');
