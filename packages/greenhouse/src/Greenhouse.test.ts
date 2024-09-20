import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Framework } from '@kpl/core';

import { GreenhouseIntegration } from '.';

const API_TOKEN = process.env.API_TOKEN!;
const dbUri = process.env.DB_URL!;
const referenceId = process.env.REFERENCE_ID!;

const integrationName = 'GREENHOUSE';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new GreenhouseIntegration()],
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

//const integration = integrationFramework.getIntegration(integrationName) as GreenhouseIntegration

describe('greenhouse', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      referenceId,
      credential: {
        value: {
          API_TOKEN,
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
