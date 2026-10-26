/**
 * A tool whose `execute` returns nothing still answers `tools/call` with a valid
 * result, instead of a -32602 protocol error after the tool already ran (Issue #28240).
 */
import { createTool } from '@mastra/core/tools';
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InternalMastraMCPClient } from '../client/client';
import { connectClient, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

describe('MCPServer tools/call with a tool that returns no value (Issue #28240)', () => {
  const calls = { voidTool: 0, functionTool: 0, nullTool: 0, optionalOutputTool: 0 };
  let served: ServedHTTP;
  let client: Client;

  beforeAll(async () => {
    served = await serveHTTP(
      new MCPServer({
        name: 'VoidResultTestServer',
        version: '1.0.0',
        tools: {
          voidTool: createTool({
            id: 'void-tool',
            description: 'Sends a notification and returns nothing',
            inputSchema: z.object({ to: z.string() }),
            execute: async () => {
              calls.voidTool++;
            },
          }),
          functionTool: createTool({
            id: 'function-tool',
            description: 'Returns a value JSON cannot represent',
            inputSchema: z.object({}),
            execute: async () => {
              calls.functionTool++;
              return (() => 'not serializable') as unknown as string;
            },
          }),
          optionalOutputTool: createTool({
            id: 'optional-output-tool',
            description: 'Declares an optional output schema and returns nothing',
            inputSchema: z.object({}),
            outputSchema: z.object({ id: z.string() }).optional(),
            execute: async () => {
              calls.optionalOutputTool++;
              return undefined;
            },
          }),
          nullTool: createTool({
            id: 'null-tool',
            description: 'Returns null',
            inputSchema: z.object({}),
            execute: async () => {
              calls.nullTool++;
              return null;
            },
          }),
        },
      }),
    );
    client = await connectClient(served.url);
  });

  afterAll(async () => {
    await client?.close();
    await served?.close();
  });

  it('returns an empty successful result to an MCP SDK client and runs the tool once', async () => {
    const before = calls.voidTool;
    const result = await client.callTool({ name: 'voidTool', arguments: { to: 'ops' } });
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([]);
    expect(calls.voidTool).toBe(before + 1);
  });

  it('returns an empty successful result for a value JSON cannot represent', async () => {
    const result = await client.callTool({ name: 'functionTool', arguments: {} });
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([]);
  });

  it('returns an empty successful result for an optional output schema left unset', async () => {
    const before = calls.optionalOutputTool;
    const result = await client.callTool({ name: 'optionalOutputTool', arguments: {} });
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([]);
    expect(result.structuredContent).toBeUndefined();
    expect(calls.optionalOutputTool).toBe(before + 1);
  });

  it('keeps serializing null as the text "null"', async () => {
    const result = await client.callTool({ name: 'nullTool', arguments: {} });
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
  });

  it('returns a successful result to a Mastra MCPClient tool', async () => {
    const mastraClient = new InternalMastraMCPClient({ name: 'void-repro', server: { url: served.url } });
    try {
      await mastraClient.connect();
      const tools = await mastraClient.tools();
      const before = calls.voidTool;
      const result = await tools['voidTool']!.execute!({ to: 'ops' }, {});
      expect(result).toMatchObject({ isError: false, content: [] });
      expect(calls.voidTool).toBe(before + 1);
    } finally {
      await mastraClient.disconnect();
    }
  });
});
