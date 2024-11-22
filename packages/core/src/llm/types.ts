import { LanguageModelV1 } from "ai";

export type OpenAIModelNames =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini';

export type OpenAIConfig = {
  provider: 'OPEN_AI';
  name: OpenAIModelNames;
  toolChoice: 'auto' | 'required';
  apiKey?: string;
};

export type GoogleModelNames =
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash';

export type GoogleConfig = {
  provider: 'GOOGLE';
  name: GoogleModelNames;
  toolChoice: 'auto' | 'required';
  apiKey?: string;
};

export type AnthropicModelNames =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20240620';

export type AnthropicConfig = {
  provider: 'ANTHROPIC';
  name: AnthropicModelNames;
  toolChoice: 'auto' | 'required';
  apiKey?: string;
};

export type GroqModelNames =
  | 'llama3-groq-70b-8192-tool-use-preview'
  | 'llama3-groq-8b-8192-tool-use-preview'
  | 'gemma2-9b-it'
  | 'gemma-7b-it';

export type GroqConfig = {
  provider: 'GROQ';
  name: GroqModelNames;
  toolChoice: 'auto' | 'required';
  apiKey?: string;
};

export type CustomModelConfig = {
  model: LanguageModelV1;
  provider: string;
  toolChoice: 'auto' | 'required';
}

export type ModelConfig =
  | OpenAIConfig
  | AnthropicConfig
  | GroqConfig
  | GoogleConfig
  | CustomModelConfig;
