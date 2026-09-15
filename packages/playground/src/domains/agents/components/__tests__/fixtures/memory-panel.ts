import type {
  BuilderSettingsResponse,
  GetMemoryStatusResponse,
  GetObservationalMemoryResponse,
  ListMemoryThreadMessagesResponse,
} from '@mastra/client-js';
import type { AuthCapabilities } from '@/domains/auth/types';

export const memoryEnabled: GetMemoryStatusResponse = {
  result: true,
};

export const rbacDisabledAuth = {
  enabled: false,
  login: null,
  user: { id: 'user-1' },
  capabilities: {
    user: true,
    session: true,
    sso: false,
    rbac: false,
    acl: false,
  },
  access: {
    roles: [],
    permissions: [],
  },
} satisfies AuthCapabilities;

export const builderDisabled: BuilderSettingsResponse = {
  enabled: false,
};

export const observationalMemory: GetObservationalMemoryResponse = {
  record: null,
  history: [
    {
      id: 'om-1',
      scope: 'thread',
      resourceId: 'agent-1',
      threadId: 'thread-1',
      activeObservations: '## Recent\n🟡 [10:01] User asked about onboarding',
      originType: 'observation',
      generationCount: 1,
      lastObservedAt: '2026-06-01T10:01:00.000Z',
      totalTokensObserved: 1200,
      observationTokenCount: 320,
      pendingMessageTokens: 540,
      isObserving: false,
      isReflecting: false,
      config: { messageTokens: 2000, observationTokens: 1000 },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:01:00.000Z',
    },
  ],
};

export const threadMessages: ListMemoryThreadMessagesResponse = {
  messages: [
    {
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      threadId: 'thread-1',
      resourceId: 'agent-1',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'hello' }],
      },
    },
  ],
};
