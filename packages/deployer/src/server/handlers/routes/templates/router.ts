import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import { installTemplateHandler } from './handlers';

export function templatesRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.post(
    '/install',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Install a template',
      tags: ['templates'],
      responses: {
        200: {
          description: 'Template installation result',
        },
        400: {
          description: 'Bad request',
        },
        500: {
          description: 'Internal server error',
        },
      },
    }),
    installTemplateHandler,
  );

  return router;
}
