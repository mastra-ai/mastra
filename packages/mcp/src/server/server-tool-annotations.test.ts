/**
 * MCP tool annotations and `_meta` are advertised on tools/list for both
 * business tools (`mcp.annotations` / `mcp._meta`) and native tools.
 */
import { createMCPTool } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectModern, serveHTTP } from './__tests__/harness';
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
  let tools: Awaited<ReturnType<Awaited<ReturnType<typeof connectModern>>['listTools']>>['tools'];

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
        nativeTool: createMCPTool({
          id: 'native-tool',
          description: 'A native tool with annotations',
          inputSchema: z.object({}),
          outputSchema: z.string(),
          annotations,
          _meta: { ui: { resourceUri: 'ui://widget' } },
          execute: async () => ({ kind: 'completed', value: 'ok' }),
        }),
      },
    });
    served = await serveHTTP(server);
    const client = await connectModern(served.url);
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

  it('exposes annotations and normalized UI _meta of native tools', () => {
    const tool = tools.find(t => t.name === 'nativeTool')!;
    expect(tool.annotations).toEqual(annotations);
    expect(tool._meta).toEqual({
      ui: { resourceUri: 'ui://widget' },
      'ui/resourceUri': 'ui://widget',
    });
  });
});
