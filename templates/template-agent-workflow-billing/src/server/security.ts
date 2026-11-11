import type { ArtifactReader } from '../billing/artifacts.js';
import type { MiddlewareHandler } from 'hono';
import { registerApiRoute } from '@mastra/core/server';
import type { ServerConfig } from '@mastra/core/server';
import type { OrganizationService } from '../billing/organizations.js';
import type { CommercialService } from '../billing/commercial.js';
import type { BillingHttpGateway } from '../billing/mastra.js';
import { billingApiRoutes } from './billing.js';

export function billingOnlyServer(
  organizations: OrganizationService,
  execution?: BillingHttpGateway,
  commercial?: CommercialService,
  studio?: { middleware: MiddlewareHandler },
  artifacts?: ArtifactReader,
): Pick<ServerConfig, 'apiRoutes' | 'middleware' | 'cors'> {
  return {
    cors: false,
    middleware: [
      {
        path: '*',
        handler:
          studio?.middleware ??
          (async (context, next) => {
            if (context.req.path.startsWith('/billing/')) return next();
            return context.json({ error: 'billing_gateway_required' }, 403);
          }),
      },
    ],
    apiRoutes: [
      ...billingApiRoutes(organizations, execution, commercial, artifacts),
      // Public native auth handlers skip user middleware. The constrained Hono
      // path excludes capabilities so Studio can still discover authentication.
      ...(studio
        ? [
            registerApiRoute('/:api{api}/auth/:action{(?!capabilities$).+}', {
              method: 'ALL',
              handler: context => context.json({ error: 'billing_gateway_required' }, 403),
            }),
          ]
        : []),
      // Discovery remains closed in both modes. With Studio disabled, also
      // cover framework-public routes that deliberately skip user middleware.
      registerApiRoute(studio ? '/.well-known/*' : '/*', {
        method: 'ALL',
        handler: context => context.json({ error: 'billing_gateway_required' }, 403),
      }),
    ],
  };
}

// Instance middleware runs before early dev/browser/learning routes, unlike the
// later server-config middleware. The fallback route covers public-route skips.
export function enforceBillingBoundary<
  T extends {
    getServer(): ServerConfig | undefined;
    setServerMiddleware(middleware: NonNullable<ServerConfig['middleware']>): void;
  },
>(mastra: T): T {
  const middleware = mastra.getServer()?.middleware;
  if (!middleware) throw new Error('The billing server boundary must be configured before serving.');
  mastra.setServerMiddleware(middleware);
  return mastra;
}
