import {createAzure} from '@ai-sdk/azure';
import config from 'config';

const azureConfig = config.get<{apiKey: string; resourceName: string; endpoint: string}>('azureOpenai');

export const azure = createAzure({
  apiKey: azureConfig.apiKey,
  resourceName: azureConfig.resourceName,
});

export function getGpt4oModel() {
  const model = azure.chat('gpt-4o');

  return model;
}
