import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { registerApiRoute } from './index';

const mockHandler = (c: Context) => c.text('OK');
const mockCreateHandler = async () => (c: Context) => c.text('OK');

describe('registerApiRoute', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'] as const)('should register a valid %s route', method => {
    let route = registerApiRoute('/test', {
      method,
      handler: mockHandler,
    });

    expect(route).toEqual({
      path: '/test',
      method,
      handler: mockHandler,
      createHandler: undefined,
      openapi: undefined,
      middleware: undefined,
    });

    route = registerApiRoute('/test', {
      method,
      createHandler: mockCreateHandler,
    });

    expect(route).toEqual({
      path: '/test',
      method,
      createHandler: mockCreateHandler,
      handler: undefined,
      openapi: undefined,
      middleware: undefined,
    });
  });

  it('should throw if path starts with /api', () => {
    expect(() => {
      registerApiRoute('/api/test', {
        method: 'GET',
        handler: mockHandler,
      } as any);
    }).toThrow(/Path must not start with "\/api", it's reserved for internal API routes/);
  });

  it('should throw if method is missing', () => {
    expect(() => {
      registerApiRoute('/test', {
        handler: mockHandler,
      } as any);
    }).toThrow(/Invalid options for route "\/test", missing "method" property/);
  });

  it('should throw if both handler and createHandler are missing', () => {
    expect(() => {
      registerApiRoute('/test', {
        method: 'GET',
      } as any);
    }).toThrow(/Invalid options for route "\/test", you must define a "handler" or "createHandler" property/);
  });

  it('should throw if both handler and createHandler are provided', () => {
    expect(() => {
      registerApiRoute('/test', {
        method: 'GET',
        handler: mockHandler,
        createHandler: mockCreateHandler,
      });
    }).toThrow(
      /Invalid options for route "\/test", you can only define one of the following properties: "handler" or "createHandler"/,
    );
  });
});
