/**
 * MCP tool annotations and `_meta` are advertised on tools/list for both
 * `mcp.annotations` / `mcp._meta`, including UI metadata normalization.
 */
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectClient, serveHTTP } from './__tests__/harness';
import type { ServedHTTP } from './__tests__/harness';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const annotations = {
  title: 'Annotated Query Tool',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

describe('MCPServer Tool Annotations (Issue #9859)', () => {
  let served: ServedHTTP;
  let tools: Awaited<ReturnType<Awaited<ReturnType<typeof connectClient>>['listTools']>>['tools'];

  beforeAll(async () => {
    const server = new MCPServer({
      name: 'AnnotationsTestServer',
      version: '1.0.0',
      tools: {
        annotatedTool: createTool({
          id: 'annotated-tool',
          description: 'A tool with MCP annotations',
          strict: true,
          inputSchema: z.object({ query: z.string().describe('The query to process') }),
          mcp: { annotations, _meta: { customField: 'custom-value', version: '1.0.0' } },
          execute: async ({ query }) => ({ result: `Processed: ${query}` }),
        }),
        uiTool: createTool({
          id: 'ui-tool',
          description: 'A tool with UI metadata',
          inputSchema: z.object({}),
          outputSchema: z.string(),
          mcp: { annotations, _meta: { ui: { resourceUri: 'ui://widget' } } },
          execute: async () => 'ok',
        }),
      },
    });
    served = await serveHTTP(server);
    const client = await connectClient(served.url);
    try {
      tools = (await client.listTools()).tools;
    } finally {
      await client.close();
    }
  });

  afterAll(async () => {
    await served.close();
  });

  it('exposes annotations and _meta of business tools', () => {
    const tool = tools.find(t => t.name === 'annotatedTool')!;
    expect(tool.annotations).toEqual(annotations);
    expect(tool._meta).toEqual({ customField: 'custom-value', version: '1.0.0', mastra: { strict: true } });
  });

  it('normalizes UI _meta so older hosts find the flat key', () => {
    const tool = tools.find(t => t.name === 'uiTool')!;
    expect(tool.annotations).toEqual(annotations);
    expect(tool._meta).toEqual({
      ui: { resourceUri: 'ui://widget' },
      'ui/resourceUri': 'ui://widget',
    });
  });
});
