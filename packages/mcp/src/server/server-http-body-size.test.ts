import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const MIB = 1024 * 1024;
const DEFAULT_MAX_REQUEST_BODY_SIZE = 4 * MIB;

/** A server exposing one tool that reports the length of the text it receives. */
function makeSizeServer(config: { maxRequestBodySize?: number }, onExecute: () => void = () => {}): MCPServer {
  return new MCPServer({
    name: 'Body Size Test Server',
    version: '1.0.0',
    tools: {
      sizeTool: createTool({
        id: 'sizeTool',
        description: 'Returns the length of the text it receives',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => {
          onExecute();
          return `size: ${text.length}`;
        },
      }),
    },
    ...config,
  });
}

describe('MCPServer HTTP request body size', () => {
  const openServers: ServedHTTP[] = [];

  async function serve(server: MCPServer): Promise<ServedHTTP> {
    const served = await serveHTTP(server);
    openServers.push(served);
    return served;
  }

  afterEach(async () => {
    await Promise.all(openServers.splice(0).map(served => served.close()));
  });

  it('rejects a body over the default 4 MiB limit with a 413 and does not run the tool', async () => {
    const onExecute = vi.fn();
    const served = await serve(makeSizeServer({}, onExecute));

    const response = await rawRequest(served.url, {
      method: 'tools/call',
      params: { name: 'sizeTool', arguments: { text: 'x'.repeat(5 * MIB) } },
      headers: { 'mcp-name': 'sizeTool' },
    });

    expect(response.status).toBe(413);
    const body = response.json();
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('Payload Too Large');
    expect(body.error.message).toContain(String(DEFAULT_MAX_REQUEST_BODY_SIZE));
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('accepts a body larger than 4 MiB when maxRequestBodySize raises the limit', async () => {
    const onExecute = vi.fn();
    const served = await serve(makeSizeServer({ maxRequestBodySize: 8 * MIB }, onExecute));

    const text = 'y'.repeat(5 * MIB);
    const response = await rawRequest(served.url, {
      method: 'tools/call',
      params: { name: 'sizeTool', arguments: { text } },
      headers: { 'mcp-name': 'sizeTool' },
    });

    expect(response.status).toBe(200);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(response.json().result.content[0].text).toBe(`size: ${text.length}`);
  });

  it('rejects a body over a lowered maxRequestBodySize with the configured limit in the message', async () => {
    const onExecute = vi.fn();
    const served = await serve(makeSizeServer({ maxRequestBodySize: 1024 }, onExecute));

    const response = await rawRequest(served.url, {
      method: 'tools/call',
      params: { name: 'sizeTool', arguments: { text: 'z'.repeat(2 * 1024) } },
      headers: { 'mcp-name': 'sizeTool' },
    });

    expect(response.status).toBe(413);
    expect(response.json().error.message).toContain('1024');
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('accepts a body under the configured limit', async () => {
    const onExecute = vi.fn();
    const served = await serve(makeSizeServer({ maxRequestBodySize: 8 * MIB }, onExecute));

    const response = await rawRequest(served.url, {
      method: 'tools/call',
      params: { name: 'sizeTool', arguments: { text: 'small' } },
      headers: { 'mcp-name': 'sizeTool' },
    });

    expect(response.status).toBe(200);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(response.json().result.content[0].text).toBe('size: 5');
  });
});
