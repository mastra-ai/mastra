import { createFramework } from '@arkw/core';
import {
  describe,
  it, //expect
} from '@jest/globals';

import { TwilioIntegration } from '.';

const ACCOUNT_SID = 'AC5ec84f282f40c877009d05409b31df75';
const AUTH_TOKEN = '356fac71cc9fd3490e8789b753c97f26';
const dbUri = 'postgresql://postgres:postgres@localhost:5432/arkwright?schema=arkw';
const referenceId = '1';

const integrationName = 'TWILIO';

const integrationFramework = createFramework({
  name: 'TestFramework',
  integrations: [new TwilioIntegration()],
  systemApis: [],
  systemEvents: {},
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '',
});

const integration = integrationFramework.getIntegration(integrationName) as TwilioIntegration;

describe('twilio', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      referenceId,
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
    const client = await integration.getApiClient({ referenceId });
    const response = await client['/2010-04-01/Accounts.json'].get();
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      referenceId,
    });
  });
});
