import { createOpenAI } from '@ai-sdk/openai';
import type { MastraLanguageModel, MastraLegacyLanguageModel } from '@mastra/core/agent';
import type {
  KeywordExtractPrompt,
  QuestionExtractPrompt,
  SummaryPrompt,
  TitleExtractorPrompt,
  TitleCombinePrompt,
} from '../prompts';

export type KeywordExtractArgs = {
  llm?: MastraLegacyLanguageModel | MastraLanguageModel;
  keywords?: number;
  promptTemplate?: KeywordExtractPrompt['template'];
};

export type QuestionAnswerExtractArgs = {
  llm?: MastraLegacyLanguageModel | MastraLanguageModel;
  questions?: number;
  promptTemplate?: QuestionExtractPrompt['template'];
  embeddingOnly?: boolean;
};

export type SummaryExtractArgs = {
  llm?: MastraLegacyLanguageModel | MastraLanguageModel;
  summaries?: string[];
  promptTemplate?: SummaryPrompt['template'];
};

export type TitleExtractorsArgs = {
  llm?: MastraLegacyLanguageModel | MastraLanguageModel;
  nodes?: number;
  nodeTemplate?: TitleExtractorPrompt['template'];
  combineTemplate?: TitleCombinePrompt['template'];
};

export const STRIP_REGEX = /(\r\n|\n|\r)/gm;

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const baseLLM: MastraLegacyLanguageModel | MastraLanguageModel = openai('gpt-4o');
