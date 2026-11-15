/**
 * A rejected tools/call input is reported back to the caller, but the server's logs carry only the
 * failing paths, never the submitted arguments (Issue #29318).
 */
import { ConsoleLogger } from '@mastra/core/logger';
import { createTool } from '@mastra/core/tools';
import { makeCoreTool } from '@mastra/core/utils';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InternalMastraMCPClient } from '../client/client';
import { connectClient, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const SECRET = 'person@example.com';

describe('MCPServer validation failure logging (Issue #29318)', () => {
  let served: ServedHTTP;
  let client: Client;
  let server: MCPServer;
  let logged: () => string;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'ValidationLoggingServer',
      version: '1.0.0',
      tools: {
        contact: createTool({
          id: 'contact',
          description: 'Contacts a person',
          inputSchema: z.object({ email: z.email(), age: z.number() }),
          execute: async () => ({ ok: true }),
        }),
        refined: createTool({
          id: 'refined',
          description: 'Only accepts emails without spaces',
          inputSchema: z.object({ email: z.string().refine(value => !value.includes(' '), 'no spaces') }),
          execute: async () => ({ ok: true }),
        }),
        explode: createTool({
          id: 'explode',
          description: 'Fails with the submitted email in its message',
          inputSchema: z.object({ email: z.string() }),
          execute: async ({ email }) => {
            throw new Error(`cannot reach ${email}`);
          },
        }),
        score: createTool({
          id: 'score',
          description: 'Scores people',
          inputSchema: z.object({ scores: z.record(z.string(), z.number()) }),
          execute: async () => ({ ok: true }),
        }),
      },
      workflows: {
        signup: createWorkflow({
          id: 'signup',
          description: 'Signs a person up',
          inputSchema: z.object({ email: z.string(), age: z.number() }),
          outputSchema: z.object({ ok: z.boolean() }),
        })
          .then(
            createStep({
              id: 'register',
              inputSchema: z.object({ email: z.string(), age: z.number() }),
              outputSchema: z.object({ ok: z.boolean() }),
              execute: async () => ({ ok: true }),
            }),
          )
          .commit(),
      },
    });
    server.__setLogger(new ConsoleLogger({ level: 'silent' }));
    const logger = server['logger'];
    const spies = (['debug', 'info', 'warn', 'error', 'trackException'] as const).map(level => vi.spyOn(logger, level));
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

  it('masks submitted record keys in the logged paths', async () => {
    const result = await client.callTool({ name: 'score', arguments: { scores: { [SECRET]: 'high' } } });

    expect(result.isError).toBe(true);
    const logs = logged();
    expect(logs).toContain('"issuePaths":["scores.*"]');
    expect(logs).not.toContain(SECRET);
  });

  it('logs only the failing paths when a workflow rejects its input', async () => {
    const result = await client.callTool({ name: 'run_signup', arguments: { email: SECRET, age: 'not-a-number' } });

    expect(result.isError).toBe(true);
    const logs = logged();
    expect(logs).toContain('"issuePaths":["age"]');
    expect(logs).not.toContain(SECRET);
    expect(logs).not.toContain('not-a-number');
  });

  it('keeps submitted arguments out of tracked execution failures', async () => {
    vi.spyOn(server as unknown as { runTool: () => Promise<never> }, 'runTool').mockRejectedValueOnce(
      new Error('tool host unavailable'),
    );

    await expect(server.executeTool('contact', { email: SECRET, age: 42 })).rejects.toMatchObject({
      id: 'MCP_SERVER_TOOL_EXECUTE_FAILED',
    });
    const logs = logged();
    expect(logs).toContain('MCP_SERVER_TOOL_EXECUTE_FAILED');
    expect(logs).toContain('"toolId":"contact"');
    expect(logs).not.toContain(SECRET);
  });

  it('keeps server error text and arguments out of MCPClient logs while the caller still sees them', async () => {
    const mcpClient = new InternalMastraMCPClient({ name: 'validation-logging', server: { url: served.url } });
    mcpClient.__setLogger(new ConsoleLogger({ level: 'silent' }));
    const clientLogger = mcpClient['logger'];
    const clientSpies = (['debug', 'info', 'warn', 'error'] as const).map(level => vi.spyOn(clientLogger, level));
    try {
      await mcpClient.connect();
      const tools = await mcpClient.tools();

      const failure = await tools.explode!.execute!({ email: SECRET }, {} as never).catch((error: unknown) => error);
      expect(String(failure)).toContain(SECRET);

      const clientLogs = JSON.stringify(clientSpies.flatMap(spy => spy.mock.calls));
      expect(clientLogs).toContain('explode');
      expect(clientLogs).not.toContain(SECRET);
    } finally {
      await mcpClient.disconnect();
    }
  });

  it.each([SECRET, 'SECRET_TOKEN'])(
    'keeps arbitrary error names and codes out of MCPClient failure logs (%s)',
    async secret => {
      const mcpClient = new InternalMastraMCPClient({ name: 'error-code', server: { url: served.url } });
      mcpClient.__setLogger(new ConsoleLogger({ level: 'silent' }));
      const clientLogger = mcpClient['logger'];
      const clientSpies = (['debug', 'info', 'warn', 'error'] as const).map(level => vi.spyOn(clientLogger, level));
      try {
        await mcpClient.connect();
        const tools = await mcpClient.tools();
        vi.spyOn(mcpClient['client'], 'callTool').mockRejectedValueOnce(
          Object.assign(new Error('failed'), { name: secret, code: secret }),
        );

        await expect(tools.explode!.execute!({ email: 'x' }, {} as never)).rejects.toThrow('failed');

        const clientLogs = JSON.stringify(clientSpies.flatMap(spy => spy.mock.calls));
        expect(clientLogs).toContain('Error calling tool: explode');
        expect(clientLogs).not.toContain(secret);
      } finally {
        await mcpClient.disconnect();
      }
    },
  );

  it('keeps transport error text out of the MCPClient reconnect log', async () => {
    const mcpClient = new InternalMastraMCPClient({ name: 'reconnect', server: { url: served.url } });
    mcpClient.__setLogger(new ConsoleLogger({ level: 'silent' }));
    const clientLogger = mcpClient['logger'];
    const clientSpies = (['debug', 'info', 'warn', 'error'] as const).map(level => vi.spyOn(clientLogger, level));
    try {
      await mcpClient.connect();
      const tools = await mcpClient.tools();
      vi.spyOn(mcpClient['client'], 'callTool').mockRejectedValueOnce(new Error(`Not connected: ${SECRET}`));

      await tools.contact!.execute!({ email: 'ok@x.dev', age: 1 }, {} as never).catch(() => undefined);

      const clientLogs = JSON.stringify(clientSpies.flatMap(spy => spy.mock.calls));
      expect(clientLogs).toContain('Transport error detected for tool contact');
      expect(clientLogs).not.toContain(SECRET);
    } finally {
      await mcpClient.disconnect();
    }
  });

  it('keeps the server error text out of the exception an agent tracks for an MCPClient tool', async () => {
    const mcpClient = new InternalMastraMCPClient({ name: 'tracked-failure', server: { url: served.url } });
    mcpClient.__setLogger(new ConsoleLogger({ level: 'silent' }));
    const agentLogger = new ConsoleLogger({ level: 'silent' });
    const trackException = vi.spyOn(agentLogger, 'trackException');
    const badEmail = `bad ${SECRET}`;
    try {
      await mcpClient.connect();
      const tools = await mcpClient.tools();
      const coreTool = makeCoreTool(tools.refined!, { name: 'refined', logger: agentLogger });

      const failure = await coreTool.execute!({ email: badEmail }, { toolCallId: 'call-1', messages: [] }).catch(
        (error: unknown) => error,
      );

      // The model still sees what the server said so it can correct the call.
      expect(String(failure)).toContain(SECRET);
      expect(trackException).toHaveBeenCalledTimes(1);
      const tracked = trackException.mock.calls[0]!;
      expect(JSON.stringify(tracked)).toContain('MCP_CLIENT_TOOL_EXECUTION_FAILED');
      expect(JSON.stringify({ ...(tracked[0] as object), message: (tracked[0] as Error).message })).not.toContain(
        SECRET,
      );
      expect(JSON.stringify(tracked[1])).not.toContain(SECRET);
    } finally {
      await mcpClient.disconnect();
    }
  });
});
