import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { generateOpenAPIDocument, convertCustomRoutesToOpenAPIPaths } from './openapi-utils';
import type { ServerRoute } from './routes';
import type { ApiRoute } from '@mastra/core/server';

const mockHandler = () => new Response('ok');

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

describe('convertCustomRoutesToOpenAPIPaths — ZodOpenAPIRouteConfig', () => {
  it('converts request.params Zod schema to path parameters', () => {
    const routes: ApiRoute[] = [
      {
        path: '/users/:id',
        method: 'GET',
        handler: mockHandler,
        openapi: {
          summary: 'Get user',
          tags: ['users'],
          request: {
            params: z.object({ id: z.string().describe('User ID') }),
          },
          responses: {
            200: { description: 'User found' },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);

    expect(paths['/users/{id}']).toBeDefined();
    const op = paths['/users/{id}']['get'];
    expect(op.summary).toBe('Get user');
    expect(op.tags).toEqual(['users']);
    expect(op.parameters).toHaveLength(1);
    expect(op.parameters[0]).toMatchObject({
      name: 'id',
      in: 'path',
      required: true,
    });
    expect(op.parameters[0].schema.type).toBe('string');
    expect(op.parameters[0].description).toBe('User ID');
  });

  it('converts request.query Zod schema to query parameters', () => {
    const routes: ApiRoute[] = [
      {
        path: '/users',
        method: 'GET',
        handler: mockHandler,
        openapi: {
          request: {
            query: z.object({
              limit: z.coerce.number().optional(),
              cursor: z.string().optional(),
            }),
          },
          responses: {
            200: { description: 'User list' },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    const op = paths['/users']['get'];

    expect(op.parameters).toHaveLength(2);
    const paramNames = op.parameters.map((p: any) => p.name);
    expect(paramNames).toContain('limit');
    expect(paramNames).toContain('cursor');
    op.parameters.forEach((p: any) => {
      expect(p.in).toBe('query');
    });
  });

  it('converts request.body Zod schema to requestBody', () => {
    const CreateUserSchema = z.object({
      name: z.string(),
      email: z.string().email(),
    });

    const routes: ApiRoute[] = [
      {
        path: '/users',
        method: 'POST',
        handler: mockHandler,
        openapi: {
          summary: 'Create user',
          request: {
            body: {
              content: {
                'application/json': { schema: CreateUserSchema },
              },
            },
          },
          responses: {
            201: { description: 'User created' },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    const op = paths['/users']['post'];

    expect(op.requestBody).toBeDefined();
    expect(op.requestBody.required).toBe(true);
    expect(op.requestBody.content['application/json']).toBeDefined();
    const schema = op.requestBody.content['application/json'].schema;
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('name');
    expect(schema.properties).toHaveProperty('email');
  });

  it('converts response Zod schemas to JSON Schema', () => {
    const UserSchema = z.object({ id: z.string(), name: z.string() });

    const routes: ApiRoute[] = [
      {
        path: '/users/:id',
        method: 'GET',
        handler: mockHandler,
        openapi: {
          request: {
            params: z.object({ id: z.string() }),
          },
          responses: {
            200: {
              description: 'User found',
              content: {
                'application/json': { schema: UserSchema },
              },
            },
            404: { description: 'User not found' },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    const op = paths['/users/{id}']['get'];

    expect(op.responses['200']).toBeDefined();
    expect(op.responses['200'].description).toBe('User found');
    const responseSchema = op.responses['200'].content['application/json'].schema;
    expect(responseSchema.type).toBe('object');
    expect(responseSchema.properties).toHaveProperty('id');
    expect(responseSchema.properties).toHaveProperty('name');

    expect(op.responses['404']).toBeDefined();
    expect(op.responses['404'].description).toBe('User not found');
    expect(op.responses['404'].content).toBeUndefined();
  });

  it('skips routes with hide: true', () => {
    const routes: ApiRoute[] = [
      {
        path: '/internal',
        method: 'GET',
        handler: mockHandler,
        openapi: {
          hide: true,
          request: {},
          responses: { 200: { description: 'ok' } },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    expect(Object.keys(paths)).toHaveLength(0);
  });

  it('handles routes with only metadata and no request schemas', () => {
    const routes: ApiRoute[] = [
      {
        path: '/health',
        method: 'GET',
        handler: mockHandler,
        openapi: {
          summary: 'Health check',
          tags: ['system'],
          request: {},
          responses: {
            200: { description: 'OK' },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    const op = paths['/health']['get'];

    expect(op.summary).toBe('Health check');
    expect(op.tags).toEqual(['system']);
    expect(op.parameters).toBeUndefined();
    expect(op.requestBody).toBeUndefined();
    expect(op.responses['200'].description).toBe('OK');
  });

  it('converts both params and body in same route', () => {
    const UpdateUserSchema = z.object({ name: z.string() });

    const routes: ApiRoute[] = [
      {
        path: '/users/:id',
        method: 'PUT',
        handler: mockHandler,
        openapi: {
          summary: 'Update user',
          request: {
            params: z.object({ id: z.string() }),
            body: {
              content: {
                'application/json': { schema: UpdateUserSchema },
              },
            },
          },
          responses: {
            200: { description: 'Updated' },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    const op = paths['/users/{id}']['put'];

    expect(op.parameters).toHaveLength(1);
    expect(op.parameters[0].name).toBe('id');
    expect(op.requestBody.content['application/json'].schema.type).toBe('object');
  });
});

describe('convertCustomRoutesToOpenAPIPaths — DescribeRouteOptions (existing format)', () => {
  it('still supports the legacy DescribeRouteOptions format with Zod schemas', () => {
    const routes: ApiRoute[] = [
      {
        path: '/items',
        method: 'GET',
        handler: mockHandler,
        openapi: {
          summary: 'List items',
          responses: {
            200: {
              description: 'Item list',
              content: {
                'application/json': {
                  schema: z.object({ items: z.array(z.string()) }),
                },
              },
            },
          },
        },
      },
    ];

    const paths = convertCustomRoutesToOpenAPIPaths(routes);
    const op = paths['/items']['get'];

    expect(op.summary).toBe('List items');
    const schema = op.responses['200'].content['application/json'].schema;
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('items');
  });
});
