import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
} from '@jest/globals';
import { Mastra } from '@mastra/core';
import type { Message } from 'mem0ai';
import { Mem0Integration } from '.';

const API_KEY = process.env.API_KEY!;
const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'MEM0';

const integrationFramework = Mastra.init({
  name: 'TestFramework',
  integrations: [new Mem0Integration({
    config: {
      apiKey: API_KEY,
      user_id: 'alice'
    }
  })],
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

describe('mem0', () => {
  let integration: Mem0Integration;

  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          API_KEY,
        },
        type: 'API_KEY',
      },
    });
    integration = integrationFramework.getIntegration(integrationName) as Mem0Integration;
  });

  describe('createMemory', () => {
    it('should create memory from string', async () => {
      const testString = 'This is a test memory';
      const result = await integration.createMemory(testString);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should create memory from messages array', async () => {
      const testMessages: Message[] = [
        {
          role: 'user',
          content: 'I love to eat pizza'
        },
        {
          role: 'user',
          content: 'I live in San Francisco'
        }
      ];
      const result = await integration.createMemory(testMessages);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('searchMemory', () => {
    it('should search memories with query', async () => {
      const query = 'What do I love to eat?';
      const result = await integration.searchMemory(query);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should search memories with options', async () => {
      const query = 'Where do I live?';
      const options = {
        user_id: 'alice'
      };
      const result = await integration.searchMemory(query, options);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
}); 