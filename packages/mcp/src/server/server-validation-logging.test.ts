/**
 * A rejected tools/call input is reported back to the caller, but the server's logs carry only the
 * failing paths, never the submitted arguments (Issue #29318).
 */
import { ConsoleLogger } from '@mastra/core/logger';
import { createTool } from '@mastra/core/tools';
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectClient, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const SECRET = 'person@example.com';

describe('MCPServer validation failure logging (Issue #29318)', () => {
  let served: ServedHTTP;
  let client: Client;
  let logged: () => string;

  beforeAll(async () => {
    const server = new MCPServer({
      name: 'ValidationLoggingServer',
      version: '1.0.0',
      tools: {
        contact: createTool({
          id: 'contact',
          description: 'Contacts a person',
          inputSchema: z.object({ email: z.email(), age: z.number() }),
          execute: async () => ({ ok: true }),
        }),
      },
    });
    server.__setLogger(new ConsoleLogger({ level: 'silent' }));
    const logger = server['logger'];
    const spies = (['debug', 'info', 'warn', 'error'] as const).map(level => vi.spyOn(logger, level));
    logged = () => JSON.stringify(spies.flatMap(spy => spy.mock.calls));
    served = await serveHTTP(server);
    client = await connectClient(served.url);
  });

  afterAll(async () => {
    await client?.close();
    await served?.close();
  });

  it('returns the validation error to the caller and logs only the failing paths', async () => {
    const result = await client.callTool({ name: 'contact', arguments: { email: SECRET, age: 'not-a-number' } });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('age');

    const logs = logged();
    expect(logs).toContain('rejected its input');
    expect(logs).toContain('"issuePaths":["age"]');
    expect(logs).not.toContain(SECRET);
    expect(logs).not.toContain('not-a-number');
  });
});
