import {
  describe,
  it, //expect
} from '@jest/globals';
import { Framework } from '@kpl/core';

import { TwilioIntegration } from '.';

const ACCOUNT_SID = '';
const AUTH_TOKEN = '';
const dbUri = 'postgresql://postgres:postgres@localhost:5432/kepler?schema=kepler';
const connectionId = '1';

const integrationName = 'TWILIO';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new TwilioIntegration()],
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

const integration = integrationFramework.getIntegration(integrationName) as TwilioIntegration;

describe('twilio', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          ACCOUNT_SID,
          AUTH_TOKEN,
        },
        type: 'API_KEY',
      },
    });
  });

  it('should 200 on some apis', async () => {
    const client = await integration.getApiClient({ connectionId });
    const response = await client['/2010-04-01/Accounts.json'].get();
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
});
