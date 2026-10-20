import { http, HttpResponse } from 'msw';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { ChatSessionContextApi } from '../../../../chat/context/ChatSessionContext';

export function stubSessionsFactory(factoryId: string, projectRepositoryIds: string[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: factoryId, name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: projectRepositoryIds.map(id => ({
              id,
              branch: 'main',
              sandboxWorkdir: `/workspace/${id}`,
              repository: { slug: `mastra-ai/${id}`, defaultBranch: 'main' },
            })),
          },
        ],
      }),
    ),
  );
}

export const LIVE_SESSION: Partial<ChatSessionContextApi> = {
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  resourceEnabled: true,
};

export function testChatSession(
  factoryId: string,
  projectRepositoryId: string,
  overrides: Partial<ChatSessionContextApi> = {},
): ChatSessionContextApi {
  return {
    sessionId: 'session-1',
    resourceId: 'resource-1',
    sessionEnabled: false,
    resourceReady: false,
    sandboxReady: false,
    sandboxPreparing: false,
    resourceEnabled: false,
    factorySessionState: { factoryProjectId: factoryId, projectRepositoryId },
    baseUrl: TEST_BASE_URL,
    kind: 'factory',
    ...overrides,
  };
}
