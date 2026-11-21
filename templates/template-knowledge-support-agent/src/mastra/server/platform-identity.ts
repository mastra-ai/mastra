import { MastraAuthStudio } from '@mastra/auth-studio';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraAuthRequest, Middleware } from '@mastra/core/server';
import { isStudioClientTypeHeader, MASTRA_CLIENT_TYPE_HEADER } from '@mastra/server/server-adapter';
import { validateProfile, type Profile } from '../identity.ts';
import type { ReviewerAuthority } from '../review/service.ts';
import { bearerToken, type LocalProfile, type SupportAuthorization } from './access.ts';

class SupportPlatformAuth extends MastraAuthStudio {
  override authenticateToken(token: string, request: MastraAuthRequest) {
    return super.authenticateToken(bearerToken(request) ?? token, request);
  }

  override getCurrentUser(request: Request) {
    // Use the same organization membership check for Studio's session status.
    return this.authenticateToken('', request);
  }
}

export function platformAuthMiddleware(bindContext?: (request: Request, context: RequestContext) => void): Middleware {
  return async (context, next) => {
    // An injected Studio provider would take precedence over the template's route policy.
    if (
      isStudioClientTypeHeader(context.req.header(MASTRA_CLIENT_TYPE_HEADER)) &&
      context.get('mastra').getStudio()?.auth
    ) {
      return context.json(
        { error: 'Set MASTRA_PLATFORM_STUDIO_AUTH=disabled to use the configured support auth' },
        403,
      );
    }
    bindContext?.(context.req.raw, context.get('requestContext'));
    await next();
  };
}

export function createPlatformIdentity(example: Profile | undefined) {
  const organizationId = process.env.MASTRA_ORGANIZATION_ID?.trim();
  if (!organizationId) throw new Error('Mastra Platform authentication requires MASTRA_ORGANIZATION_ID');
  if (!example) throw new Error('Mastra Platform authentication requires a profile in the initial example dataset');
  const { tenantId, customerId } = example;

  const contexts = new WeakMap<Request, RequestContext>();
  const reviewers = new WeakMap<Profile, LocalProfile>();
  const reviewerAuthority: ReviewerAuthority = profile => reviewers.get(profile) ?? null;

  function createAuth(authorize: SupportAuthorization) {
    return new SupportPlatformAuth({
      organizationId,
      secureCookies: true,
      async authorizeUser(user, authRequest) {
        const request = authRequest instanceof Request ? authRequest : authRequest.raw;
        const context = request && contexts.get(request);
        const role = user.role;
        if (!request || !context || user.organizationId !== organizationId) return false;
        if (role !== 'admin' && role !== 'owner' && role !== 'member' && role !== 'viewer') return false;
        if (role === 'viewer' && request.method !== 'GET') return false;
        if (request.method === 'POST') {
          const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
          const fetchSite = request.headers.get('sec-fetch-site');
          if (contentType !== 'application/json' || (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none'))
            return false;
        }

        const profile: LocalProfile = {
          id: user.id,
          actorId: JSON.stringify(['mastra-platform', organizationId, user.id]),
          tenantId,
          customerId,
          role,
          review: role === 'admin' || role === 'owner',
        };
        try {
          validateProfile(profile);
        } catch {
          return false;
        }
        if (profile.review) reviewers.set(profile, profile);
        const allowed = await authorize(new URL(request.url).pathname, request.method, request, profile, context);
        if (allowed) {
          context.set('mastra__user', profile);
          context.set('user', profile);
        }
        return allowed;
      },
    });
  }

  return {
    createAuth,
    reviewerAuthority,
    middleware: platformAuthMiddleware((request, context) => contexts.set(request, context)),
  };
}
