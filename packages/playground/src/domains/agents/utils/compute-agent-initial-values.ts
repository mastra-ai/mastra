import type { GetAgentResponse, StoredAgentResponse } from '@mastra/client-js';
import { parse as superjsonParse } from 'superjson';

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

/**
 * Map a `GetAgentResponse` (from `GET /agents/:id`) into an `AgentDataSource`
 * that the CMS edit form can consume. This allows code-defined agents to be
 * loaded into the edit form for creating stored config overrides.
 */
export function mapAgentResponseToDataSource(agent: GetAgentResponse): AgentDataSource {
  // Parse requestContextSchema from stringified JSON to an object.
  // Code agents serialize with superjson.stringify(), so we use superjsonParse
  // to unwrap the {json: {...}} envelope. Stored agents provide a plain object.
  let requestContextSchema: unknown;
  if (agent.requestContextSchema) {
    try {
      requestContextSchema =
        typeof agent.requestContextSchema === 'string'
          ? superjsonParse(agent.requestContextSchema)
          : agent.requestContextSchema;
    } catch {
      // Invalid JSON — skip
    }
  }

  return {
    name: agent.name,
    description: agent.description,
    instructions: agent.instructions,
    model: { provider: agent.provider, name: agent.modelId },
    tools: agent.tools,
    workflows: agent.workflows,
    agents: agent.agents,
    // agent.skills is SkillMetadata[] (workspace-discovered skills for the agent),
    // not the stored-skill-config shape the edit form consumes. Code-defined agents
    // have no stored skill overrides, so leave this unset.
    skills: undefined,
    workspace: agent.workspaceId ? ({ workspaceId: agent.workspaceId } as AgentDataSource['workspace']) : undefined,
    requestContextSchema,
  };
}

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
