import type { StoredAgentResponse } from '@mastra/client-js';

import type { AgentFormValues, EntityConfig } from '../components/agent-edit-page/utils/form-validation';

import {
  normalizeToolsToRecord,
  normalizeIntegrationToolsToRecord,
  normalizeScorersFromApi,
  normalizeSkillsFromApi,
  normalizeWorkspaceFromApi,
  mapInstructionBlocksFromApi,
  parseObservationalMemoryFromApi,
} from './agent-form-mappers';

export interface AgentDataSource {
  name?: string;
  description?: string;
  instructions?: unknown;
  model?: unknown;
  tools?: unknown;
  integrationTools?: unknown;
  workflows?: unknown;
  agents?: unknown;
  scorers?: unknown;
  memory?: unknown;
  mcpClients?: unknown;
  skills?: StoredAgentResponse['skills'];
  workspace?: StoredAgentResponse['workspace'];
  requestContextSchema?: unknown;
}

export function computeAgentInitialValues(dataSource: AgentDataSource): Partial<AgentFormValues> {
  const toolsRecord = normalizeToolsToRecord(dataSource.tools as Parameters<typeof normalizeToolsToRecord>[0]);

  const memoryData = dataSource.memory as
    | {
        vector?: string;
        embedder?: string;
        options?: { lastMessages?: number | false; semanticRecall?: boolean; readOnly?: boolean };
        observationalMemory?:
          | boolean
          | {
              model?: string;
              scope?: 'resource' | 'thread';
              shareTokenBudget?: boolean;
              observation?: {
                model?: string;
                messageTokens?: number;
                maxTokensPerBatch?: number;
                bufferTokens?: number | false;
                bufferActivation?: number;
                blockAfter?: number;
              };
              reflection?: {
                model?: string;
                observationTokens?: number;
                blockAfter?: number;
                bufferActivation?: number;
              };
            };
      }
    | undefined;

  const { instructionsString, instructionBlocks } = mapInstructionBlocksFromApi(
    dataSource.instructions as Parameters<typeof mapInstructionBlocksFromApi>[0],
  );

  return {
    name: dataSource.name || '',
    description: dataSource.description || '',
    instructions: instructionsString,
    model: {
      provider: (dataSource.model as { provider?: string; name?: string })?.provider || '',
      name: (dataSource.model as { provider?: string; name?: string })?.name || '',
    },
    tools: toolsRecord,
    integrationTools: normalizeIntegrationToolsToRecord(
      dataSource.integrationTools as Record<string, { tools?: Record<string, EntityConfig> }> | undefined,
    ),
    workflows: normalizeToolsToRecord(dataSource.workflows as Parameters<typeof normalizeToolsToRecord>[0]),
    agents: normalizeToolsToRecord(dataSource.agents as Parameters<typeof normalizeToolsToRecord>[0]),
    scorers: normalizeScorersFromApi(dataSource.scorers as Parameters<typeof normalizeScorersFromApi>[0]),
    memory: memoryData?.options
      ? {
          enabled: true,
          lastMessages: memoryData.options.lastMessages,
          semanticRecall: memoryData.options.semanticRecall,
          readOnly: memoryData.options.readOnly,
          vector: memoryData.vector,
          embedder: memoryData.embedder,
          observationalMemory: parseObservationalMemoryFromApi(memoryData.observationalMemory),
        }
      : undefined,
    instructionBlocks,
    skills: normalizeSkillsFromApi(dataSource.skills),
    workspace: normalizeWorkspaceFromApi(dataSource.workspace),
    variables: dataSource.requestContextSchema as AgentFormValues['variables'],
  };
}
