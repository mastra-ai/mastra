import {
  CoreAssistantMessage as AiCoreAssistantMessage,
  CoreMessage as AiCoreMessage,
  CoreSystemMessage as AiCoreSystemMessage,
  CoreToolMessage as AiCoreToolMessage,
  CoreUserMessage as AiCoreUserMessage,
  EmbedManyResult as AiEmbedManyResult,
  EmbedResult as AiEmbedResult,
  GenerateObjectResult,
  GenerateTextResult,
  LanguageModelV1,
  StreamObjectResult,
  StreamTextResult,
} from 'ai';
import { JSONSchema7 } from 'json-schema';
import { z, ZodSchema } from 'zod';

import { ToolsInput } from '../agent/types';
import { Run } from '../run/types';
import { CoreTool } from '../tools/types';

export type OpenAIModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1'
  | 'o1-mini'
  | 'o1-preview';

export type CoreMessage = AiCoreMessage;

export type CoreSystemMessage = AiCoreSystemMessage;

export type CoreAssistantMessage = AiCoreAssistantMessage;

export type CoreUserMessage = AiCoreUserMessage;

export type CoreToolMessage = AiCoreToolMessage;

export type EmbedResult<T> = AiEmbedResult<T>;

export type EmbedManyResult<T> = AiEmbedManyResult<T>;

export type OpenAIConfig = {
  provider: 'OPEN_AI';
  name: OpenAIModel | (string & {});
  toolChoice?: 'auto' | 'required';
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type GoogleModel =
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash'
  | 'gemini-2.0-flash-exp-latest'
  | 'gemini-2.0-flash-thinking-exp-1219'
  | 'gemini-exp-1206';

export type GoogleConfig = {
  provider: 'GOOGLE';
  name: GoogleModel | (string & {});
  toolChoice?: 'auto' | 'required';
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export interface GoogleGenerativeAISettings {
  /**
  Optional.
  The name of the cached content used as context to serve the prediction.
  Format: cachedContents/{cachedContent}
     */
  cachedContent?: string;
  /**
   * Optional. Enable structured output. Default is true.
   *
   * This is useful when the JSON Schema contains elements that are
   * not supported by the OpenAPI schema version that
   * Google Generative AI uses. You can use this to disable
   * structured outputs if you need to.
   */
  structuredOutputs?: boolean;
  /**
  Optional. A list of unique safety settings for blocking unsafe content.
     */
  safetySettings?: Array<{
    category:
      | 'HARM_CATEGORY_HATE_SPEECH'
      | 'HARM_CATEGORY_DANGEROUS_CONTENT'
      | 'HARM_CATEGORY_HARASSMENT'
      | 'HARM_CATEGORY_SEXUALLY_EXPLICIT';
    threshold:
      | 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
      | 'BLOCK_LOW_AND_ABOVE'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_NONE';
  }>;
}

export type AnthropicModel =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307';

export type AnthropicConfig = {
  provider: 'ANTHROPIC';
  name: AnthropicModel | (string & {});
  toolChoice?: 'auto' | 'required';
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type GroqModel =
  | 'llama3-groq-70b-8192-tool-use-preview'
  | 'llama3-groq-8b-8192-tool-use-preview'
  | 'gemma2-9b-it'
  | 'gemma-7b-it';

export type GroqConfig = {
  provider: 'GROQ';
  name: GroqModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type PerplexityModel =
  | 'llama-3.1-sonar-small-128k-online'
  | 'llama-3.1-sonar-large-128k-online'
  | 'llama-3.1-sonar-huge-128k-online'
  | 'llama-3.1-sonar-small-128k-chat'
  | 'llama-3.1-sonar-large-128k-chat'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.1-70b-instruct'
  | 'sonar'
  | 'sonar-pro';

export type PerplexityConfig = {
  provider: 'PERPLEXITY';
  name: PerplexityModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type TogetherAiModel =
  | 'codellama/CodeLlama-34b-Instruct-hf'
  | 'upstage/SOLAR-10.7B-Instruct-v1.0'
  | 'mistralai/Mixtral-8x7B-v0.1'
  | 'WhereIsAI/UAE-Large-V1'
  | 'black-forest-labs/FLUX.1-depth'
  | 'togethercomputer/m2-bert-80M-32k-retrieval'
  | 'black-forest-labs/FLUX.1-canny'
  | 'black-forest-labs/FLUX.1-dev'
  | 'black-forest-labs/FLUX.1-redux'
  | 'BAAI/bge-large-en-v1.5'
  | 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo'
  | 'togethercomputer/Llama-3-8b-chat-hf-int4'
  | 'stabilityai/stable-diffusion-xl-base-1.0'
  | 'Gryphe/MythoMax-L2-13b'
  | 'meta-llama/Meta-Llama-3-8B'
  | 'mistralai/Mixtral-8x7B-Instruct-v0.1'
  | 'deepseek-ai/deepseek-llm-67b-chat'
  | 'togethercomputer/m2-bert-80M-8k-retrieval'
  | 'llava-hf/llava-v1.6-mistral-7b-hf'
  | 'Qwen/Qwen2.5-Coder-32B-Instruct'
  | 'databricks/dbrx-instruct'
  | 'meta-llama/Meta-Llama-3.1-405B-Instruct-Lite-Pro'
  | 'meta-llama/Meta-Llama-3-8B-Instruct-Lite'
  | 'scb10x/scb10x-llama3-typhoon-v1-5-8b-instruct'
  | 'microsoft/WizardLM-2-8x22B'
  | 'BAAI/bge-base-en-v1.5'
  | 'togethercomputer/m2-bert-80M-2k-retrieval'
  | 'google/gemma-2b-it'
  | 'meta-llama/Llama-2-70b-hf'
  | 'mistralai/Mistral-7B-Instruct-v0.2'
  | 'meta-llama/LlamaGuard-2-8b'
  | 'mistralai/Mistral-7B-Instruct-v0.1'
  | 'mistralai/Mistral-7B-v0.1'
  | 'black-forest-labs/FLUX.1-pro'
  | 'black-forest-labs/FLUX.1-schnell'
  | 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo'
  | 'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF'
  | 'mistralai/Mistral-7B-Instruct-v0.3'
  | 'Meta-Llama/Llama-Guard-7b'
  | 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo'
  | 'meta-llama/Meta-Llama-3-70B-Instruct-Lite'
  | 'google/gemma-2-27b-it'
  | 'meta-llama/Llama-3-8b-chat-hf'
  | 'Qwen/Qwen2.5-72B-Instruct-Turbo'
  | 'Salesforce/Llama-Rank-V1'
  | 'meta-llama/Llama-Guard-3-11B-Vision-Turbo'
  | 'google/gemma-2-9b-it'
  | 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo'
  | 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO'
  | 'meta-llama/Llama-3-70b-chat-hf'
  | 'Qwen/Qwen2.5-7B-Instruct-Turbo'
  | 'scb10x/scb10x-llama3-typhoon-v1-5x-4f316'
  | 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
  | 'Gryphe/MythoMax-L2-13b-Lite'
  | 'black-forest-labs/FLUX.1-schnell-Free'
  | 'meta-llama/Llama-2-7b-chat-hf'
  | 'meta-llama/Meta-Llama-Guard-3-8B'
  | 'togethercomputer/Llama-3-8b-chat-hf-int8'
  | 'meta-llama/Llama-Vision-Free'
  | 'Qwen/Qwen2-72B-Instruct'
  | 'mistralai/Mixtral-8x22B-Instruct-v0.1'
  | 'black-forest-labs/FLUX.1.1-pro'
  | 'meta-llama/Llama-3.2-3B-Instruct-Turbo'
  | 'meta-llama/Llama-2-13b-chat-hf'
  | 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  | 'Nexusflow/NexusRaven-V2-13B'
  | 'bert-base-uncased'
  | 'WizardLM/WizardLM-13B-V1.2'
  | 'google/gemma-7b'
  | 'togethercomputer/Koala-7B'
  | 'zero-one-ai/Yi-34B'
  | 'togethercomputer/StripedHyena-Hessian-7B'
  | 'teknium/OpenHermes-2-Mistral-7B'
  | 'Qwen/Qwen2-7B-Instruct'
  | 'togethercomputer/guanaco-65b'
  | 'togethercomputer/llama-2-7b'
  | 'hazyresearch/M2-BERT-2k-Retrieval-Encoder-V1'
  | 'huggyllama/llama-7b'
  | 'Undi95/ReMM-SLERP-L2-13B'
  | 'NousResearch/Nous-Capybara-7B-V1p9'
  | 'lmsys/vicuna-7b-v1.3'
  | 'Undi95/Toppy-M-7B'
  | 'Qwen/Qwen2-72B'
  | 'NousResearch/Nous-Hermes-Llama2-70b'
  | 'WizardLM/WizardLM-70B-V1.0'
  | 'huggyllama/llama-65b'
  | 'lmsys/vicuna-13b-v1.5-16k'
  | 'openchat/openchat-3.5-1210'
  | 'Qwen/Qwen1.5-0.5B'
  | 'Qwen/Qwen1.5-4B'
  | 'Qwen/Qwen1.5-7B'
  | 'snorkelai/Snorkel-Mistral-PairRM-DPO'
  | 'Qwen/Qwen1.5-14B-Chat'
  | 'Qwen/Qwen1.5-1.8B-Chat'
  | 'Snowflake/snowflake-arctic-instruct'
  | 'togethercomputer/llama-2-13b'
  | 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT'
  | 'deepseek-ai/deepseek-coder-33b-instruct'
  | 'togethercomputer/CodeLlama-7b-Instruct'
  | 'NousResearch/Nous-Hermes-Llama2-13b'
  | 'lmsys/vicuna-13b-v1.5'
  | 'togethercomputer/guanaco-13b'
  | 'togethercomputer/CodeLlama-34b-Instruct'
  | 'togethercomputer/llama-2-70b'
  | 'codellama/CodeLlama-13b-Instruct-hf'
  | 'Qwen/Qwen2-7B'
  | 'Qwen/Qwen2-1.5B'
  | 'togethercomputer/CodeLlama-13b-Instruct'
  | 'meta-llama/Llama-2-13b-hf'
  | 'togethercomputer/llama-2-13b-chat'
  | 'huggyllama/llama-30b'
  | 'NousResearch/Nous-Hermes-2-Mistral-7B-DPO'
  | 'togethercomputer/alpaca-7b'
  | 'google/gemma-7b-it'
  | 'allenai/OLMo-7B'
  | 'togethercomputer/guanaco-33b'
  | 'togethercomputer/llama-2-7b-chat'
  | 'togethercomputer/SOLAR-10.7B-Instruct-v1.0-int4'
  | 'togethercomputer/guanaco-7b'
  | 'Open-Orca/Mistral-7B-OpenOrca'
  | 'Qwen/Qwen1.5-32B'
  | 'EleutherAI/llemma_7b'
  | 'NousResearch/Nous-Hermes-llama-2-7b'
  | 'Qwen/Qwen1.5-32B-Chat'
  | 'meta-llama/Meta-Llama-3-70B'
  | 'meta-llama/Llama-3-8b-hf'
  | 'sentence-transformers/msmarco-bert-base-dot-v5'
  | 'zero-one-ai/Yi-6B'
  | 'meta-llama/Meta-Llama-3-8B-Instruct'
  | 'teknium/OpenHermes-2p5-Mistral-7B'
  | 'Qwen/Qwen1.5-4B-Chat'
  | 'wavymulder/Analog-Diffusion'
  | 'runwayml/stable-diffusion-v1-5'
  | 'prompthero/openjourney'
  | 'meta-llama/Llama-2-7b-hf'
  | 'SG161222/Realistic_Vision_V3.0_VAE'
  | 'Qwen/Qwen1.5-0.5B-Chat'
  | 'codellama/CodeLlama-7b-Instruct-hf'
  | 'google/gemma-2b'
  | 'mistralai/Mixtral-8x22B'
  | 'meta-llama/Llama-2-70b-chat-hf'
  | 'zero-one-ai/Yi-34B-Chat'
  | 'google/gemma-2-9b'
  | 'meta-llama/Meta-Llama-3-70B-Instruct'
  | 'togethercomputer/LLaMA-2-7B-32K'
  | 'codellama/CodeLlama-70b-Instruct-hf'
  | 'NousResearch/Hermes-2-Theta-Llama-3-70B'
  | 'test/test11'
  | 'stabilityai/stable-diffusion-2-1'
  | 'microsoft/phi-2'
  | 'Qwen/Qwen1.5-7B-Chat'
  | 'cognitivecomputations/dolphin-2.5-mixtral-8x7b'
  | 'togethercomputer/evo-1-131k-base'
  | 'togethercomputer/evo-1-8k-base'
  | 'togethercomputer/llama-2-70b-chat'
  | 'Qwen/Qwen1.5-14B'
  | 'carson/ml318br'
  | 'meta-llama/Meta-Llama-3.1-8B-Instruct-Reference'
  | 'meta-llama/Meta-Llama-3.1-8B-Reference'
  | 'gradientai/Llama-3-70B-Instruct-Gradient-1048k'
  | 'meta-llama/Meta-Llama-3.1-70B-Reference'
  | 'meta-llama/Meta-Llama-3.1-70B-Instruct-Reference'
  | 'meta-llama/Llama-3-70b-hf'
  | 'Qwen/Qwen2-1.5B-Instruct'
  | 'NousResearch/Nous-Hermes-13b'
  | 'HuggingFaceH4/zephyr-7b-beta'
  | 'Austism/chronos-hermes-13b'
  | 'Qwen/Qwen1.5-1.8B'
  | 'Qwen/Qwen1.5-72B'
  | 'lmsys/vicuna-13b-v1.3'
  | 'huggyllama/llama-13b'
  | 'garage-bAInd/Platypus2-70B-instruct'
  | 'allenai/OLMo-7B-Instruct'
  | 'togethercomputer/Koala-13B'
  | 'lmsys/vicuna-7b-v1.5';

export type TogetherAiConfig = {
  provider: 'TOGETHER_AI';
  name: TogetherAiModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type LMStudioModel =
  | 'qwen2-7b-instruct-4bit'
  | 'qwen2-math-1.5b'
  | 'qwen2-0.5b'
  | 'aya-23-8b'
  | 'mistral-7b-v0.3'
  | 'stablecode'
  | 'cohere-command-r-v01-4bit'
  | 'command-r'
  | 'starcoder2-7b'
  | 'deepseek-math-7b'
  | 'qwen2.5-coder-14b'
  | 'qwen2.5-coder-32b'
  | 'qwen2.5-coder-3b'
  | 'llama-3.2-3b-instruct-4bit'
  | 'llama-3.2-1b'
  | 'llama-3.2-3b'
  | 'qwen2.5-coder-7b'
  | 'qwen2.5-14b'
  | 'yi-coder-9b'
  | 'hermes-3-llama-3.1-8b'
  | 'internlm-2.5-20b'
  | 'llava-v1.5'
  | 'llama-3.1-8b-instruct-4bit'
  | 'meta-llama-3.1-8b'
  | 'mistral-nemo-2407'
  | 'mistral-nemo-instruct-2407-4bit'
  | 'gemma-2-2b'
  | 'mathstral-7b'
  | 'gemma-2-9b'
  | 'deepseek-coder-v2-lite-instruct-4bit'
  | 'smollm-360m-v0.2'
  | 'phi-3-mini-4k-instruct-4bit'
  | 'gemma-2-27b'
  | 'codestral-22b'
  | 'phi-3.1-mini-128k'
  | 'deepseek-coder-v2-lite';

export type LMStudioConfig = {
  provider: 'LM_STUDIO';
  name: LMStudioModel | (string & {});
  toolChoice?: 'auto' | 'required';
  baseURL: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type BasetenModel =
  | 'llama-3.1-70b-instruct'
  | 'qwen2.5-7b-math-instruct'
  | 'qwen2.5-14b-instruct'
  | 'qwen2.5-32b-coder-instruct'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.1-nemetron-70b'
  | 'llama-3.2-90b-vision-instruct'
  | 'llama-3.1-405b-instruct'
  | 'ultravox-v0.4'
  | 'llama-3.2-1b-vision-instruct'
  | 'llama-3-70b-instruct'
  | 'llama-3-8b-instruct'
  | 'mistral-7b-instruct'
  | 'qwen2.5-14b-coder-instruct'
  | 'qwen2.5-7b-coder-instruct'
  | 'qwen2.5-72b-math-instruct'
  | 'qwen2.5-72b-instruct'
  | 'qwen2.5-32b-instruct'
  | 'qwen2.5-7b-instruct'
  | 'qwen2.5-3b-instruct'
  | 'pixtral-12b'
  | 'phi-3.5-mini-instruct'
  | 'gemma-2-9b'
  | 'gemma-2-27b'
  | 'phi-3-mini-128k-instruct'
  | 'phi-3-mini-4k-instruct'
  | 'zephyr-7b-alpha'
  | 'mixtral-8x7b-instruct'
  | 'mixtral-8x22b';

export type BaseTenConfig = {
  provider: 'BASETEN';
  name: BasetenModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type FireworksModel =
  | 'llama-3.1-405b-instruct'
  | 'llama-3.1-70b-instruct'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.2-3b-instruct';

export type FireworksConfig = {
  provider: 'FIREWORKS';
  name: FireworksModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type MistralModel =
  | 'pixtral-large-latest'
  | 'mistral-large-latest'
  | 'mistral-small-latest'
  | 'ministral-3b-latest'
  | 'ministral-8b-latest'
  | 'pixtral-12b-2409';

export type MistralConfig = {
  provider: 'MISTRAL';
  name: MistralModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type XGrokModel = 'grok-beta' | 'grok-vision-beta';

export type XGrokConfig = {
  provider: 'X_GROK';
  name: XGrokModel | (string & {});
  toolChoice?: 'auto' | 'required';
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type CustomModelConfig = {
  model: LanguageModelV1 | (() => Promise<LanguageModelV1>);
  provider: string;
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type CohereModel = 'command-r-plus';

export type CohereConfig = {
  provider: 'COHERE';
  name: CohereModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type AzureModel = 'gpt-35-turbo-instruct';

export type AzureConfig = {
  provider: 'AZURE';
  name: AzureModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  headers?: Record<string, string>;
  apiVersion?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
};

export type DeepseekModel = 'deepseek-chat' | 'deepseek-reasoner';

export type DeepseekConfig = {
  provider: 'DEEPSEEK';
  name: DeepseekModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type AmazonModel =
  | 'amazon-titan-tg1-large'
  | 'amazon-titan-text-express-v1'
  | 'anthropic-claude-3-5-sonnet-20241022-v2:0'
  | 'anthropic-claude-3-5-sonnet-20240620-v1:0'
  | 'anthropic-claude-3-5-haiku-20241022-v1:0'
  | 'anthropic-claude-3-opus-20240229-v1:0'
  | 'anthropic-claude-3-sonnet-20240229-v1:0'
  | 'anthropic-claude-3-haiku-20240307-v1:0'
  | 'anthropic-claude-v2:1'
  | 'cohere-command-r-v1:0'
  | 'cohere-command-r-plus-v1:0'
  | 'meta-llama2-13b-chat-v1'
  | 'meta-llama2-70b-chat-v1'
  | 'meta-llama3-8b-instruct-v1:0'
  | 'meta-llama3-70b-instruct-v1:0'
  | 'meta-llama3-1-8b-instruct-v1:0'
  | 'meta-llama3-1-70b-instruct-v1:0'
  | 'meta-llama3-1-405b-instruct-v1:0'
  | 'meta-llama3-2-1b-instruct-v1:0'
  | 'meta-llama3-2-3b-instruct-v1:0'
  | 'meta-llama3-2-11b-instruct-v1:0'
  | 'meta-llama3-2-90b-instruct-v1:0'
  | 'mistral-mistral-7b-instruct-v0:2'
  | 'mistral-mixtral-8x7b-instruct-v0:1'
  | 'mistral-mistral-large-2402-v1:0'
  | 'mistral-mistral-small-2402-v1:0';

export type AmazonConfig = {
  provider: 'AMAZON';
  name: AmazonModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type AnthropicVertexModel =
  | 'claude-3-5-sonnet@20240620'
  | 'claude-3-opus@20240229'
  | 'claude-3-sonnet@20240229'
  | 'claude-3-haiku@20240307';

export type AnthropicVertexConfig = {
  provider: 'ANTHROPIC_VERTEX';
  name: AnthropicVertexModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

type BuiltInModelConfig =
  | OpenAIConfig
  | AnthropicConfig
  | GroqConfig
  | GoogleConfig
  | PerplexityConfig
  | TogetherAiConfig
  | LMStudioConfig
  | BaseTenConfig
  | FireworksConfig
  | MistralConfig
  | XGrokConfig
  | CohereConfig
  | AzureConfig
  | AmazonConfig
  | AnthropicVertexConfig
  | DeepseekConfig;

export type ModelConfig = BuiltInModelConfig | CustomModelConfig;

export type LLMProvider = BuiltInModelConfig['provider'];

export type BaseStructuredOutputType = 'string' | 'number' | 'boolean' | 'date';

export type StructuredOutputType = 'array' | 'string' | 'number' | 'object' | 'boolean' | 'date';

export type StructuredOutputArrayItem =
  | {
      type: BaseStructuredOutputType;
    }
  | {
      type: 'object';
      items: StructuredOutput;
    };

export type StructuredOutput = {
  [key: string]:
    | {
        type: BaseStructuredOutputType;
      }
    | {
        type: 'object';
        items: StructuredOutput;
      }
    | {
        type: 'array';
        items: StructuredOutputArrayItem;
      };
};

export type GenerateReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? GenerateTextResult<any, any>
  : GenerateObjectResult<any>;

export type StreamReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? StreamTextResult<any, any>
  : StreamObjectResult<any, any, any>;

export type OutputType = 'text' | StructuredOutput;

export type LLMStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  runId?: string;
  onFinish?: (result: string) => Promise<void> | void;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  output?: OutputType | Z;
  temperature?: number;
};

export type LLMTextOptions = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  toolChoice?: 'auto' | 'required';
  maxSteps?: number;
  temperature?: number;
} & Run;

export type LLMTextObjectOptions<T> = LLMTextOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};

export type LLMInnerStreamOptions = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  onFinish?: (result: string) => Promise<void> | void;
  maxSteps?: number;
  temperature?: number;
} & Run;

export type LLMStreamObjectOptions<T> = LLMInnerStreamOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};
