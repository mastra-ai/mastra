import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { generateOpenAPIDocument } from './openapi-utils';
import type { ServerRoute } from './routes';

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
