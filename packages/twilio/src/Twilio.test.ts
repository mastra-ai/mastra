import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Framework } from '@mastra/core';

import { TwilioIntegration } from '.';

const ACCOUNT_SID = process.env.ACCOUNT_SID!;
const AUTH_TOKEN = process.env.AUTH_TOKEN!;
const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'TWILIO';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new TwilioIntegration()],
  workflows: {
    systemApis: [],
    blueprintDirPath: '',
    systemEvents: {},
  },
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/mastra',
});

//const integration = integrationFramework.getIntegration(integrationName) as TwilioIntegration

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
