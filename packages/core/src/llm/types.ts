export type OpenAIVercelModelNames =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini';

export type OpenAIVercelConfig = {
  provider: 'OPEN_AI_VERCEL';
  name: OpenAIVercelModelNames;
  toolChoice: 'auto' | 'required';
};

export type GoogleVercelModelNames =
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash';

export type GoogleVercelConfig = {
  provider: 'GOOGLE_VERCEL';
  name: GoogleVercelModelNames;
  toolChoice: 'auto' | 'required';
};

export type AnthropicVercelModelNames =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20240620';

export type AnthropicVercelConfig = {
  provider: 'ANTHROPIC_VERCEL';
  name: AnthropicVercelModelNames;
  toolChoice: 'auto' | 'required';
};

export type GroqVercelModelNames =
  | 'llama3-groq-70b-8192-tool-use-preview'
  | 'llama3-groq-8b-8192-tool-use-preview'
  | 'gemma2-9b-it'
  | 'gemma-7b-it';

export type GroqVercelConfig = {
  provider: 'GROQ_VERCEL';
  name: GroqVercelModelNames;
  toolChoice: 'auto' | 'required';
};

export type ModelConfig =
  | OpenAIVercelConfig
  | AnthropicVercelConfig
  | GroqVercelConfig
  | GoogleVercelConfig;
