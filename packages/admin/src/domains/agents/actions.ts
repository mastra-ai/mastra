'use server';

import path from 'path';

import { framework } from '@/lib/framework-utils';

import { AgentWriterService } from '@/service/service.agentWriter';
import { FileEnvService } from '@/service/service.fileEnv';

export const getAgents = async () => {
  const agentsDirPath = await getAgentsDirPath();
  const agentWriter = new AgentWriterService(agentsDirPath);
  return agentWriter.getAgents();
};

export const getAgent = async (agentId: string) => {
  const agentsDirPath = await getAgentsDirPath();
  const agentWriter = new AgentWriterService(agentsDirPath);
  return agentWriter.readAgent(path.join(agentsDirPath, `${agentId}.json`));
};

export const saveAgent = async ({ agentId, data }: { agentId: string; data: any }) => {
  const agentsDirPath = await getAgentsDirPath();
  const agentWriter = new AgentWriterService(agentsDirPath);
  await agentWriter.writeAgent(path.join(agentsDirPath, `${agentId}.json`), data);

  await agentWriter.createAgentLog(agentId, data);
};

export const deleteAgent = async (agentId: string) => {
  const agentsDirPath = await getAgentsDirPath();
  const agentWriter = new AgentWriterService(agentsDirPath);
  return agentWriter.deleteAgent(path.join(agentsDirPath, `${agentId}.json`));
};

export const getAgentsDirPath = async () => {
  const ARK_APP_DIR = process.env.ARK_APP_DIR || process.cwd();
  return path.join(ARK_APP_DIR, framework?.config?.agents?.agentDirPath || '/agents');
};

export const saveApiKeyToEnvAction = async ({ modelProvider, apiKey }: { modelProvider: string; apiKey: string }) => {
  const rootPath = process.env.ARK_APP_DIR || process.cwd();
  const envPath = path.join(rootPath, '.env');
  const envWriter = new FileEnvService(envPath);
  envWriter.setEnvValue(`${modelProvider.toUpperCase()}_API_KEY`, apiKey);
};

export const getApiKeyFromEnvAction = async (modelProvider: string): Promise<string | null> => {
  const rootPath = process.env.ARK_APP_DIR || process.cwd();
  const envPath = path.join(rootPath, '.env');
  const envReader = new FileEnvService(envPath);
  const apiKey = await envReader.getEnvValue(`${modelProvider.toUpperCase()}_API_KEY`);
  return apiKey;
};

export const createOpenAiAssitant = async ({
  name,
  instructions,
  model,
}: {
  name: string;
  instructions: string;
  model: string;
}) => {
  const assitant = await framework?.openAIAssistant?.createAssistantAgent({
    name,
    instructions,
    model,
    tools: [],
  });

  return { id: assitant?.id! };
};
