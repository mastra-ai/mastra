import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { convertCustomRoutesToOpenAPIPaths, generateOpenAPIDocument } from './openapi-utils';
import type { ServerRoute } from './routes';
import { createRoute } from './routes/route-builder';

describe('generateOpenAPIDocument', () => {
  it('does not pollute Object.prototype when a route path is "__proto__"', () => {
    const pollutingRoute = {
      method: 'GET',
      path: '__proto__',
      openapi: {
        summary: 's',
        description: 'd',
        tags: ['t'],
        requestParams: {},
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: z.object({ polluted: z.boolean() }),
              },
            },
          },
        },
      },
      handler: () => new Response('ok'),
    } as unknown as ServerRoute;

    generateOpenAPIDocument([pollutingRoute], { title: 't', version: '1' });

    expect(({} as any).polluted).toBeUndefined();
    expect(({} as any).get).toBeUndefined();
  });
});

describe('convertCustomRoutesToOpenAPIPaths', () => {
  it('does not pollute Object.prototype when a route path is "__proto__"', () => {
    const pollutingRoute = {
      method: 'GET',
      path: '__proto__',
      handler: async () => new Response('ok'),
      openapi: { summary: 'polluting' },
    } as unknown as ApiRoute;

    try {
      const paths = convertCustomRoutesToOpenAPIPaths([pollutingRoute]);

      expect(({} as any).get).toBeUndefined();
      expect(Object.getOwnPropertyDescriptor(paths, '__proto__')?.value.get.summary).toBe('polluting');
    } finally {
      delete (Object.prototype as any).get;
    }
  });

  it('does not classify Hono routes by an incidental responseType property', () => {
    const route = Object.assign(
      registerApiRoute('/legacy', {
        method: 'GET',
        handler: async c => c.json({ ok: true }),
        openapi: { summary: 'Legacy route' },
      }),
      { responseType: 'json' },
    ) as unknown as ApiRoute;

    const paths = convertCustomRoutesToOpenAPIPaths([route]);

    expect(paths['/legacy'].get.summary).toBe('Legacy route');
  });

  it('converts schema metadata from createRoute routes', () => {
    const route = createRoute({
      method: 'POST',
      path: '/widgets/:widgetId',
      responseType: 'json',
      deprecated: true,
      pathParamSchema: z.object({ widgetId: z.string() }),
      bodySchema: z.object({ name: z.string() }),
      responseSchema: z.object({ id: z.string() }),
      handler: async () => ({ id: 'widget-1' }),
    });

    expect(route._mastraSchemaRoute).toBe(true);
    const paths = convertCustomRoutesToOpenAPIPaths([route satisfies ApiRoute]);

    expect(paths['/widgets/{widgetId}'].post.deprecated).toBe(true);
    expect(paths['/widgets/{widgetId}'].post.parameters).toEqual([
      expect.objectContaining({ name: 'widgetId', in: 'path', required: true }),
    ]);
    expect(paths['/widgets/{widgetId}'].post.requestBody.content['application/json'].schema).toMatchObject({
      type: 'object',
      required: ['name'],
    });
    expect(paths['/widgets/{widgetId}'].post.responses['200'].content['application/json'].schema).toMatchObject({
      type: 'object',
      required: ['id'],
    });
  });

  describe('component schemas', () => {
    interface Node {
      name: string;
      children: Node[];
    }
    const Node: z.ZodType<Node> = z.lazy(() => z.object({ name: z.string(), children: z.array(Node) }));
    const Invoice = z.object({ number: z.string() }).meta({ id: 'Invoice' });
    const routes = () => [
      createRoute({
        method: 'POST',
        path: '/nodes',
        responseType: 'json',
        bodySchema: z.object({ node: Node }),
        responseSchema: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true }),
      }) satisfies ApiRoute,
      registerApiRoute('/invoices', {
        method: 'GET',
        handler: async c => c.json({}),
        openapi: {
          responses: {
            200: {
              description: 'ok',
              content: { 'application/json': { schema: z.object({ invoice: Invoice }) as any } },
            },
          },
        },
      }),
    ];

    it('hoists nested definitions into the map it is given', () => {
      const componentSchemas: Record<string, any> = {};
      const paths = convertCustomRoutesToOpenAPIPaths(routes(), componentSchemas);

      expect(componentSchemas.Invoice).toMatchObject({ properties: { number: { type: 'string' } } });
      expect(paths['/invoices'].get.responses['200'].content['application/json'].schema.properties.invoice).toEqual({
        $ref: '#/components/schemas/Invoice',
      });
      expect(JSON.stringify(paths)).not.toMatch(/"(\$defs|definitions)":/);
    });

    it('leaves definitions nested when no component map is given', () => {
      const paths = convertCustomRoutesToOpenAPIPaths(routes());
      const serialized = JSON.stringify(paths);

      // Without a map the caller serves no components, so no ref may point into them.
      expect(serialized).not.toContain('#/components/schemas/');
      expect(paths['/invoices'].get.responses['200'].content['application/json'].schema.$defs.Invoice).toMatchObject({
        properties: { number: { type: 'string' } },
      });
      expect(serialized).toMatch(/"(\$defs|definitions)":/);
    });
  });
});
