import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Mastra } from '@mastra/core';

import { ZendeskIntegration } from '.';

// We need to OAuth from admin

const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;

const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'ZENDESK';

const integrationFramework = Mastra.init({
  name: 'TestFramework',
  integrations: [
    new ZendeskIntegration({
      config: {
        CLIENT_ID,
        CLIENT_SECRET,
        ZENDESK_SUBDOMAIN: '',
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

//const integration = integrationFramework.getIntegration(integrationName) as ZendeskIntegration

describe('zendesk', () => {
  beforeAll(async () => {});

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ connectionId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {});
});
