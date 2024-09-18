import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Framework } from '@kpl/core';

import { ClaudeIntegration } from '.';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const dbUri = process.env.DB_URL!;
const referenceId = process.env.REFERENCE_ID!;

const integrationName = 'CLAUDE';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new ClaudeIntegration()],
  systemApis: [],
  systemEvents: {},
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/kepler',
  blueprintDirPath: '',
});

//const integration = integrationFramework.getIntegration(integrationName) as ClaudeIntegration

describe('claude', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      referenceId,
      credential: {
        value: {
          ANTHROPIC_API_KEY,
        },
        type: 'API_KEY',
      },
    });
  });

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ referenceId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      referenceId,
    });
  });
});
