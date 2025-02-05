import { MastraLLM } from '../model';

import { openaiCompat } from './openai-compat';

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
  | 'deepseek-coder-v2-lite'
  | (string & {});

export class LMStudio extends MastraLLM {
  constructor({ name, baseURL }: { name: LMStudioModel; baseURL: string }) {
    super({ model: openaiCompat({ modelName: name, baseURL }) });
  }
}
