import { createOpenAI } from '@ai-sdk/openai';
import type { MastraLanguageModel } from '@mastra/core/agent';
import type {
  KeywordExtractPrompt,
  QuestionExtractPrompt,
  SummaryPrompt,
  TitleExtractorPrompt,
  TitleCombinePrompt,
} from 'llamaindex';

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

export const STRIP_REGEX = /(\r\n|\n|\r)/gm;

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const baseLLM: MastraLanguageModel = openai('gpt-4o');
