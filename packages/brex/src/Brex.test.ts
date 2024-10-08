import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Framework } from '@mastra/core';

import { BrexIntegration } from '.';

// We need to OAuth from admin

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
undefined;
const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'BREX';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [
    new BrexIntegration({
      config: {
        CLIENT_ID,
        CLIENT_SECRET,
        undefined,
      },
    }),
  ],
  workflows: {
    systemApis: [],
    systemEvents: {},
    blueprintDirPath: '',
  },
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  agents: {
    agentDirPath: '/mastra-agents',
    vectorProvider: [],
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/mastra',
});

const integration = integrationFramework.getIntegration(integrationName) as BrexIntegration;

describe('brex', () => {
  beforeAll(async () => {});

  it('should 200 on some apis', async () => {
    const client = await integration.getApiClient({ connectionId });
    //@ts-ignore
    const response = await client['/api/v1/system/health'].get({});
    expect(response.status).toBe(200);
  });

  afterAll(async () => {});
});
