import type {
  KeywordExtractPrompt,
  QuestionExtractPrompt,
  SummaryPrompt,
  TitleExtractorPrompt,
  TitleCombinePrompt,
} from '@llamaindex/core/prompts';
import type { MastraLanguageModel } from '@mastra/core/agent';

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
