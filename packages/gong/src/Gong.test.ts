import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Framework } from '@kpl/core';

import { GongIntegration } from '.';

const ACCESS_KEY = process.env.ACCESS_KEY!;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET!;
const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'GONG';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new GongIntegration()],
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

//const integration = integrationFramework.getIntegration(integrationName) as GongIntegration

describe('gong', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          ACCESS_KEY,
          ACCESS_KEY_SECRET,
        },
        type: 'API_KEY',
      },
    });
  });

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ connectionId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
});
