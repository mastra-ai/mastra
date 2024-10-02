import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect, //expect
} from '@jest/globals';
import { Framework } from '@mastra/core';

import { ZendeskIntegration } from '.';

// We need to OAuth from admin

const ZENDESK_SUBDOMAIN = 'mastra4011';
const CLIENT_ID = 'mastra';
const CLIENT_SECRET = 'd8f2e7b1cc1a861e6441bb7218ac3c0d9ba625a2415696d9190f0a90402a3da5';
const dbUri = 'postgresql://postgres:postgres@localhost:5432/mastra?schema=mastra';
const connectionId = '3';

const integrationName = 'ZENDESK';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [
    new ZendeskIntegration({
      config: {
        CLIENT_ID,
        CLIENT_SECRET,
        ZENDESK_SUBDOMAIN,
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

const integration = integrationFramework.getIntegration(integrationName) as ZendeskIntegration;

describe('zendesk', () => {
  beforeAll(async () => {});

  it('should 200 on some apis', async () => {
    const client = await integration.getApiClient({ connectionId });
    const response = await client['/api/v2/users/me'].get({
      headers: {
        // @ts-ignore
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      console.log({ response });
    }
    expect(response.status).toBe(200);
  });

  afterAll(async () => {});
});
