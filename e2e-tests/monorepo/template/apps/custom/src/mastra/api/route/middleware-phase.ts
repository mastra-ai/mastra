import { registerApiRoute } from '@mastra/core/server';
import type { Middleware } from '@mastra/core/server';

function appendPhase(c: { get: (key: 'requestContext') => any }, phase: string) {
  const requestContext = c.get('requestContext');
  requestContext.set('phases', [...(requestContext.get('phases') ?? []), phase]);
}

export const middlewarePhases: Middleware[] = [
  {
    path: '/phase/*',
    phase: 'afterAuth',
    handler: async (c, next) => {
      appendPhase(c, 'afterAuth');
      await next();
      c.header('x-after-auth', 'ran');
    },
  },
  {
    path: '/phase/*',
    handler: async (c, next) => {
      appendPhase(c, 'beforeAuth');
      await next();
    },
  },
];

export const phaseOrderRoute = registerApiRoute('/phase/order', {
  method: 'GET',
  handler: async c => c.json({ phases: c.get('requestContext').get('phases') ?? [] }),
});

export const phasePublicRoute = registerApiRoute('/phase/public', {
  method: 'GET',
  requiresAuth: false,
  handler: async c => c.json({ phases: c.get('requestContext').get('phases') ?? [] }),
});
