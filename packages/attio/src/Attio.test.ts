import {
  describe,
  it, //expect
} from '@jest/globals';
import { createFramework } from '@kpl/core';

import { AttioIntegration } from '.';

// We need to OAuth from admin

undefined;
const dbUri = 'postgresql://postgres:postgres@localhost:5432/kepler?schema=kepler';
const referenceId = '1';

const integrationName = 'ATTIO';

const integrationFramework = createFramework({
  name: 'TestFramework',
  integrations: [
    new AttioIntegration({
      config: {
        CLIENT_ID,
        CLIENT_SECRET,
      },
    }),
  ],
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

//const integration = integrationFramework.getIntegration(integrationName) as AttioIntegration

describe('attio', () => {
  beforeAll(async () => {});

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ referenceId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {});
});
