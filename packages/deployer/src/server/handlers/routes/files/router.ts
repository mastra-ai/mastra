import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import { getFileContentTypeHandler } from './handlers';

export function filesRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.post(
    '/content-type',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Get the content type of a file',
      tags: ['files'],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } } } } },
      },
      responses: {
        200: {
          description: 'Content type of the file',
        },
        404: {
          description: 'File not found',
        },
      },
    }),
    getFileContentTypeHandler,
  );

  return router;
}
