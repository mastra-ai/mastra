import { createDeepInfra } from '@ai-sdk/deepinfra';

import { MastraLLM } from '../model';

export type DeepInfraModel =
  | 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
  | 'meta-llama/Llama-3.3-70B-Instruct'
  | 'meta-llama/Meta-Llama-3.1-405B-Instruct'
  | 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  | 'meta-llama/Meta-Llama-3.1-70B-Instruct'
  | 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
  | 'meta-llama/Meta-Llama-3.1-8B-Instruct'
  | 'meta-llama/Llama-3.2-11B-Vision-Instruct'
  | 'meta-llama/Llama-3.2-90B-Vision-Instruct'
  | 'mistralai/Mixtral-8x7B-Instruct-v0.1'
  | 'deepseek-ai/DeepSeek-V3'
  | 'nvidia/Llama-3.1-Nemotron-70B-Instruct'
  | 'Qwen/Qwen2-7B-Instruct'
  | 'Qwen/Qwen2.5-72B-Instruct'
  | 'Qwen/Qwen2.5-Coder-32B-Instruct'
  | 'Qwen/QwQ-32B-Preview'
  | 'google/codegemma-7b-it'
  | 'google/gemma-2-9b-it'
  | 'microsoft/WizardLM-2-8x22B'
  | (string & {});

export class DeepInfra extends MastraLLM {
  constructor({
    name = 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    apiKey = process.env.DEEPINFRA_API_KEY || '',
    baseURL = 'https://api.deepinfra.com/v1/openai',
  }: {
    name?: DeepInfraModel;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const deepinfraModel = createDeepInfra({
      baseURL,
      apiKey,
    });
    super({ model: deepinfraModel(name) });
  }
}
