import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { Framework } from '@mastra/core';

import { GithubIntegration } from '.';

const API_KEY = process.env.API_KEY;
const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'GITHUB';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new GithubIntegration()],
  systemApis: [],
  systemEvents: {},
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/mastra',
  blueprintDirPath: '',
});

const integration = integrationFramework.getIntegration(integrationName) as GithubIntegration;

describe('github', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          API_KEY,
        },
        type: 'API_KEY',
      },
    });
  });

  it('should 200 on some apis', async () => {
    const client = await integration.getApiClient({ connectionId });
    const response = await client['/gists'].get();
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
});
