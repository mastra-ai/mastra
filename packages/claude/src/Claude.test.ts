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
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'CLAUDE';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new ClaudeIntegration()],
  workflows: {
    systemApis: [],
    systemEvents: {},
    blueprintDirPath: '',
  },
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/kepler',
});

const integration = integrationFramework.getIntegration(integrationName) as ClaudeIntegration;

describe('claude', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          ANTHROPIC_API_KEY,
        },
        type: 'API_KEY',
      },
    });
  });

  it('should 200 on some apis', async () => {
    const client = await integration.getApiClient({ connectionId });
    const response = await client['/complete'].post({
      json: {
        prompt: 'test',
        model: 'gpt-3.5-turbo',
        temperature: null,
        top_k: null,
        top_p: null,
        max_tokens_to_sample: null,
        stream: {},
        stop_sequences: null,
      },
    });
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
});
