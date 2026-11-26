import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import type { ServerRoute } from './routes';
import { createRoute } from './routes/route-builder';
import { MastraServer } from './index';

class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();
}

async function getServedDocument(mastra: Mastra) {
  const server = new TestMastraServer({ app: {}, mastra, openapiPath: '/openapi.json' });
  await server.registerOpenAPIRoute({}, {}, { prefix: '/api' });
  const route = server.registerRoute.mock.calls.map(([, r]) => r as ServerRoute).find(r => r.path === '/openapi.json');
  expect(route).toBeDefined();
  // Round-trip through JSON so we assert on exactly what is served over HTTP.
  return JSON.parse(JSON.stringify(await route!.handler({} as any)));
}

function collectRefs(node: unknown, at: string, out: Array<{ ref: string; at: string }>) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => collectRefs(child, `${at}/${i}`, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') out.push({ ref: value, at });
    else collectRefs(value, `${at}/${key}`, out);
  }
}

function resolvePointer(doc: unknown, ref: string): unknown {
  if (!ref.startsWith('#')) return undefined;
  const pointer = ref.slice(1);
  if (pointer === '') return doc;
  if (!pointer.startsWith('/')) return undefined;
  let current: any = doc;
  for (const raw of pointer.slice(1).split('/')) {
    const segment = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function findUnresolvedRefs(doc: unknown) {
  const refs: Array<{ ref: string; at: string }> = [];
  collectRefs(doc, '#', refs);
  return {
    refs,
    unresolved: refs.filter(({ ref }) => {
      const target = resolvePointer(doc, ref);
      // A ref to the document root (or to a non-schema) is never a valid schema reference.
      return target === undefined || target === doc || target === null || typeof target !== 'object';
    }),
  };
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const JsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(z.string(), JsonValue)]),
);

interface Category {
  name: string;
  children: Category[];
}
const Category: z.ZodType<Category> = z.lazy(() => z.object({ name: z.string(), children: z.array(Category) }));

const CategoryId = z.string().regex(/^cat_/).meta({ id: 'CategoryId' });

// A different schema registered under the same zod id, to force a component-name collision.
const Invoice = z.object({ number: z.string(), total: z.number() }).meta({ id: 'Invoice' });
const OtherInvoice = z.object({ invoiceId: z.string() }).meta({ id: 'Invoice' });

describe('served OpenAPI document $refs (#27153)', () => {
  it('resolves every $ref for a bare Mastra instance', async () => {
    const doc = await getServedDocument(new Mastra({ logger: false }));

    const { refs, unresolved } = findUnresolvedRefs(doc);
    // Built-in routes use recursive (z.lazy) schemas, so the document must contain refs.
    expect(refs.length).toBeGreaterThan(0);
    expect(unresolved).toEqual([]);
  });

  it('resolves every $ref for custom routes with recursive and id-tagged schemas', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          registerApiRoute('/invoices/latest', {
            method: 'GET',
            openapi: {
              responses: {
                200: {
                  description: 'ok',
                  content: { 'application/json': { schema: z.object({ invoice: Invoice }) as any } },
                },
              },
            },
            handler: c => c.json({ invoice: { number: 'INV-1', total: 1 } }),
          }),
          registerApiRoute('/invoices/other', {
            method: 'POST',
            openapi: {
              requestBody: {
                content: { 'application/json': { schema: z.object({ other: OtherInvoice, meta: JsonValue }) as any } },
              },
              responses: {
                200: {
                  description: 'ok',
                  content: { 'application/json': { schema: z.object({ invoice: Invoice }) as any } },
                },
              },
            },
            handler: c => c.json({}),
          }),
          createRoute({
            method: 'POST',
            path: '/categories/:categoryId',
            responseType: 'json',
            // An id-tagged path param emits its own definitions, so path params must be hoisted too.
            pathParamSchema: z.object({ categoryId: CategoryId }),
            queryParamSchema: z.object({ filter: JsonValue.optional() }),
            bodySchema: z.object({ category: Category }),
            responseSchema: z.object({ category: Category, meta: JsonValue }),
            handler: async () => ({ category: { name: 'root', children: [] }, meta: null }),
          }),
          createRoute({
            method: 'GET',
            path: '/categories/tree',
            responseType: 'json',
            responseSchema: Category,
            handler: async () => ({ name: 'root', children: [] }),
          }),
        ],
      },
    });

    const doc = await getServedDocument(mastra);

    const { unresolved } = findUnresolvedRefs(doc);
    expect(unresolved).toEqual([]);

    // The user-supplied id is kept as the component name, and the colliding
    // definition gets its own name instead of overwriting it.
    expect(doc.components.schemas.Invoice).toMatchObject({ properties: { number: {}, total: {} } });
    const invoiceRef = doc.paths['/invoices/latest'].get.responses['200'].content['application/json'].schema;
    expect(resolvePointer(doc, invoiceRef.properties.invoice.$ref)).toBe(doc.components.schemas.Invoice);
    const otherRef = doc.paths['/invoices/other'].post.requestBody.content['application/json'].schema;
    expect(resolvePointer(doc, otherRef.properties.other.$ref)).toMatchObject({
      properties: { invoiceId: {} },
    });
    expect(resolvePointer(doc, invoiceRef.properties.invoice.$ref)).toMatchObject({
      properties: { number: {}, total: {} },
    });
    expect(otherRef.properties.other.$ref).not.toBe(invoiceRef.properties.invoice.$ref);
    expect(resolvePointer(doc, otherRef.properties.other.$ref)).not.toHaveProperty('properties.number');

    const categoryIdParam = doc.paths['/categories/{categoryId}'].post.parameters.find(
      (p: any) => p.in === 'path' && p.name === 'categoryId',
    );
    expect(resolvePointer(doc, categoryIdParam.schema.$ref)).toMatchObject({ type: 'string', pattern: '^cat_' });

    // No route schema still carries a nested definitions block.
    expect(JSON.stringify(doc.paths)).not.toMatch(/"(\$defs|definitions)":/);
  });
});
