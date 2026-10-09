import type { AgentControllerSessionState } from '@mastra/client-js';
import type { DefaultModelResponse, OMConfigInfo, ProvidersResponse, ThinkingConfigInfo } from '../../../api/types';
import type { FactoryProjectPayload } from '../../domains/workspaces/services/github';

export const settingsFactory: FactoryProjectPayload = {
  id: 'fp-1',
  name: 'Mastra',
  defaultModelId: 'openai/gpt-4o-mini',
};

export const settingsSession: AgentControllerSessionState = {
  controllerId: 'code',
  resourceId: 'fp-1',
  modeId: 'build',
  modelId: 'openai/gpt-4o-mini',
  threadId: 'thread-1',
  settings: { thinkingLevel: 'medium', yolo: false, notifications: 'off', smartEditing: true },
};

export const settingsProviders: ProvidersResponse = {
  orgKeyAdmin: true,
  providers: [{ provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true }],
};

export const settingsDefaultModel: DefaultModelResponse = {
  modelId: null,
};

export const settingsMemory: OMConfigInfo = {
  observer: {
    model: 'openai/gpt-4o-mini',
    effectiveModelId: 'openai/gpt-4o-mini',
    effectiveModelSource: 'explicit',
    providerStatus: 'available',
  },
  reflector: {
    model: 'openai/gpt-4o-mini',
    effectiveModelId: 'openai/gpt-4o-mini',
    effectiveModelSource: 'explicit',
    providerStatus: 'available',
  },
  observerModelId: 'openai/gpt-4o-mini',
  reflectorModelId: 'openai/gpt-4o-mini',
  observationThreshold: 1000,
  reflectionThreshold: 2000,
  observeAttachments: 'auto',
};

export const settingsThinking: ThinkingConfigInfo = {
  globalDefault: 'off',
  modeDefaults: {},
  modes: [],
  levels: ['off', 'low', 'medium', 'high'],
  editable: false,
};
