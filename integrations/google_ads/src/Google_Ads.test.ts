import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Mastra } from '@mastra/core';

import { Google_AdsIntegration } from '.';

// We need to OAuth from admin

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;

const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'GOOGLE_ADS';

const integrationFramework = Mastra.init({
  name: 'TestFramework',
  integrations: [
    new Google_AdsIntegration({
      config: {
        CLIENT_ID,
        CLIENT_SECRET,
        undefined,
      },
    }),
  ],
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

//const integration = integrationFramework.getIntegration(integrationName) as Google_AdsIntegration

describe('google_ads', () => {
  beforeAll(async () => {});

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ connectionId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {});
});
