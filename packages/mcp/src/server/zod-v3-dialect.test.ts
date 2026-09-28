/**
 * Regression for #24403: zod v3 tool schemas were advertised as JSON Schema 2019-09,
 * which MCPClient's validator could not load, so every tool call failed.
 */
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';
import { InternalMastraMCPClient } from '../client/client';
import { connectClient, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

type Node = { name: string; children?: Node[] };
const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.object({ name: z.string(), children: z.array(nodeSchema).optional() }),
);

describe('MCPServer with zod v3 schemas', () => {
  let served: ServedHTTP;

  beforeAll(async () => {
    const server = new MCPServer({
      name: 'ZodV3Server',
      version: '1.0.0',
      tools: {
        calculator: createTool({
          id: 'calculator',
          description: 'Arithmetic',
          inputSchema: z.object({ operation: z.enum(['add', 'subtract']), a: z.number(), b: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          execute: async ({ operation, a, b }) => ({ result: operation === 'add' ? a + b : a - b }),
        }),
        point: createTool({
          id: 'point',
          description: 'Labels a point',
          inputSchema: z.object({ point: z.tuple([z.number(), z.number()]).rest(z.string()) }),
          execute: async ({ point }) => ({ label: `${point[0]},${point[1]}:${point.slice(2).join('|')}` }),
        }),
        tree: createTool({
          id: 'tree',
          description: 'Counts nodes',
          inputSchema: z.object({ root: nodeSchema }),
          execute: async ({ root }) => {
            const count = (n: Node): number => 1 + (n.children ?? []).reduce((s, c) => s + count(c), 0);
            return { count: count(root) };
          },
        }),
      },
    });
    served = await serveHTTP(server);
  });

  afterAll(async () => {
    await served.close();
  });

  it('advertises JSON Schema 2020-12 on tools/list', async () => {
    const client = await connectClient(served.url);
    try {
      const { tools } = await client.listTools();
      const calculator = tools.find(t => t.name === 'calculator')!;
      expect(calculator.inputSchema.$schema).toBe(JSON_SCHEMA_2020_12);
      expect(calculator.outputSchema?.$schema).toBe(JSON_SCHEMA_2020_12);
      expect(tools.find(t => t.name === 'tree')!.inputSchema.$schema).toBe(JSON_SCHEMA_2020_12);
      expect((tools.find(t => t.name === 'point')!.inputSchema.properties as any).point).toMatchObject({
        prefixItems: [{ type: 'number' }, { type: 'number' }],
        items: { type: 'string' },
      });
    } finally {
      await client.close();
    }
  });

  it('lets MCPClient call zod v3 tools, including tuple and recursive schemas', async () => {
    const client = new InternalMastraMCPClient({ name: 'zod-v3-client', server: { url: served.url } });
    try {
      await client.connect();
      const tools = await client.tools();
      const calc = (await tools['calculator'].execute!({ operation: 'add', a: 10, b: 32 }, {})) as any;
      expect(JSON.stringify(calc)).toContain('42');
      const tree = (await tools['tree'].execute!(
        { root: { name: 'a', children: [{ name: 'b' }, { name: 'c', children: [{ name: 'd' }] }] } },
        {},
      )) as any;
      expect(JSON.stringify(tree)).toContain('4');
      const point = (await tools['point'].execute!({ point: [1, 2, 'a', 'b'] }, {})) as any;
      expect(JSON.stringify(point)).toContain('1,2:a|b');
    } finally {
      await client.disconnect();
    }
  });
});
