import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { LocalSandbox } from '../../workspace/sandbox/local-sandbox';
import { createTool } from '../tool';
import { createCodeMode } from './code-mode';
import { StdioCodeModeTransport } from './transport';
import type { CodeModeToolResult } from './types';

// Minimal execution context the tool needs (observe + abortSignal).
const ctx = () => ({
  observe: {
    span: async (_n: string, fn: () => any) => fn(),
    log: () => {},
  },
});

function run(tool: any, code: string): Promise<CodeModeToolResult> {
  return tool.execute({ code }, ctx());
}

describe('Code Mode e2e (LocalSandbox)', () => {
  const getTopProducts = createTool({
    id: 'getTopProducts',
    description: 'Get top selling products',
    inputSchema: z.object({ limit: z.number() }),
    outputSchema: z.object({
      products: z.array(z.object({ id: z.string(), name: z.string(), totalSales: z.number() })),
    }),
    execute: async ({ limit }) => ({
      products: Array.from({ length: limit }, (_, i) => ({
        id: `p${i}`,
        name: `Product ${i}`,
        totalSales: (i + 1) * 100,
      })),
    }),
  });

  const getProductRatings = createTool({
    id: 'getProductRatings',
    description: 'Get ratings for a product',
    inputSchema: z.object({ productId: z.string() }),
    outputSchema: z.object({ ratings: z.array(z.object({ score: z.number() })) }),
    execute: async ({ productId }) => {
      const seed = Number(productId.replace('p', ''));
      return { ratings: [{ score: 4 + (seed % 2) }, { score: 3 + (seed % 3) }] };
    },
  });

  it('collapses an N+1 task into one call with correct math (the headline case)', async () => {
    const sandbox = new LocalSandbox();
    const { tool } = createCodeMode({ tools: { getTopProducts, getProductRatings }, sandbox });

    const result = await run(
      tool,
      `
        const top = await external_getTopProducts({ limit: 3 });
        const ratings = await Promise.all(
          top.products.map((p) => external_getProductRatings({ productId: p.id }))
        );
        console.log('fetched', top.products.length, 'products');
        return top.products.map((product, i) => {
          const scores = ratings[i].ratings.map((r) => r.score);
          const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
          return { name: product.name, sales: product.totalSales, averageRating: Math.round(avg * 100) / 100 };
        });
      `,
    );

    expect(result.success).toBe(true);
    expect(result.logs).toContain('fetched 3 products');
    const rows = result.result as Array<{ name: string; sales: number; averageRating: number }>;
    expect(rows).toHaveLength(3);
    // p0 -> scores [4,3] -> 3.5 ; p1 -> [5,4] -> 4.5 ; p2 -> [4,5] -> 4.5
    expect(rows[0]).toEqual({ name: 'Product 0', sales: 100, averageRating: 3.5 });
    expect(rows[1]).toEqual({ name: 'Product 1', sales: 200, averageRating: 4.5 });
    expect(rows[2]).toEqual({ name: 'Product 2', sales: 300, averageRating: 4.5 });
  }, 30_000);

  it('runs external_* calls through the real Mastra tool (input validation enforced)', async () => {
    const execute = vi.fn(async ({ limit }: { limit: number }) => ({
      products: Array.from({ length: limit }, (_, i) => ({ id: `p${i}`, name: `P${i}`, totalSales: i })),
    }));
    const spied = createTool({
      id: 'getTopProducts',
      description: 'x',
      inputSchema: z.object({ limit: z.number() }),
      outputSchema: z.object({
        products: z.array(z.object({ id: z.string(), name: z.string(), totalSales: z.number() })),
      }),
      execute,
    });
    const sandbox = new LocalSandbox();
    const { tool } = createCodeMode({ tools: { getTopProducts: spied }, sandbox });

    const ok = await run(tool, `const r = await external_getTopProducts({ limit: 2 }); return r.products.length;`);
    expect(ok.success).toBe(true);
    expect(ok.result).toBe(2);
    expect(execute).toHaveBeenCalledWith({ limit: 2 }, expect.anything());

    // Invalid input must be rejected by the tool's own validation, surfaced as a thrown error.
    const bad = await run(tool, `return await external_getTopProducts({ limit: 'nope' });`);
    expect(bad.success).toBe(false);
    expect(bad.error?.message).toBeTruthy();
  }, 30_000);

  it('reports program errors without crashing', async () => {
    const sandbox = new LocalSandbox();
    const { tool } = createCodeMode({ tools: { getTopProducts }, sandbox });
    const result = await run(tool, `throw new Error('boom');`);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('boom');
  }, 30_000);

  it('returns results larger than the stdout pipe buffer', async () => {
    const sandbox = new LocalSandbox();
    const { tool } = createCodeMode({ tools: { getTopProducts }, sandbox });
    const payload = 'x'.repeat(1024 * 1024);
    const result = await run(tool, `return 'x'.repeat(${payload.length});`);

    expect(result.success).toBe(true);
    expect(result.result).toBe(payload);
  }, 30_000);

  it('reports errors larger than the stdout pipe buffer', async () => {
    const sandbox = new LocalSandbox();
    const { tool } = createCodeMode({ tools: { getTopProducts }, sandbox });
    const message = 'x'.repeat(1024 * 1024);
    const result = await run(tool, `throw new Error('x'.repeat(${message.length}));`);

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(message);
  }, 30_000);

  it('enforces the allow-list for tools not exposed', async () => {
    // Build a transport directly and dispatch only known ids; call an unlisted one.
    const transport = new StdioCodeModeTransport();
    const sandbox = new LocalSandbox();
    const result = await transport.run({
      sandbox,
      program: `return await external_secret({});`,
      toolIds: ['known'],
      dispatch: async () => ({ ok: true }),
      timeout: 15_000,
    });
    // external_secret is undefined inside the runner -> ReferenceError surfaces as failure.
    // Assert the specific reason so this protects allow-list behavior, not just any failure.
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/external_secret/);
  }, 30_000);

  it('times out a runaway program', async () => {
    const sandbox = new LocalSandbox();
    const { tool } = createCodeMode({ tools: { getTopProducts }, sandbox, timeout: 500 });
    const result = await run(tool, `await new Promise((r) => setTimeout(r, 10000)); return 1;`);
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TimeoutError');
  }, 30_000);

  it('throws when no sandbox is configured (no implicit host fallback)', async () => {
    const { tool } = createCodeMode({ tools: { getTopProducts } });
    await expect(run(tool, `return 1;`)).rejects.toThrow(/requires a sandbox/);
  });
});
