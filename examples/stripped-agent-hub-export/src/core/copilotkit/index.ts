import {OpenAIAdapter} from '@copilotkit/runtime';
import {OpenAI} from 'openai';
import config from 'config';

export const azureConfig = config.get<{apiKey: string; resourceName: string; endpoint: string}>('azureOpenai');

const openai = new OpenAI({
  apiKey: azureConfig.apiKey,
  baseURL: `${azureConfig.endpoint}openai/deployments/gpt-4o`,
  defaultQuery: {'api-version': '2024-04-01-preview'},
  defaultHeaders: {'api-key': azureConfig.apiKey},
});
export const openaiServiceAdapter = new OpenAIAdapter({openai});
