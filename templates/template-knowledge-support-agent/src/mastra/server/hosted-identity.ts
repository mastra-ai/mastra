import { validateProfile, type Profile } from '../identity.ts';
import type { LocalProfile } from './access.ts';

/** RFC 7662 introspection. Tokens exist only in the incoming request and outbound form. */
export function createHostedIdentity() {
  const endpoint = process.env.SUPPORT_OAUTH_INTROSPECTION_URL;
  const serviceToken = process.env.SUPPORT_OAUTH_INTROSPECTION_TOKEN;
  const issuer = process.env.SUPPORT_OAUTH_ISSUER;
  const audience = process.env.SUPPORT_OAUTH_AUDIENCE;
  if (!endpoint || !serviceToken?.trim() || /[\r\n]/u.test(serviceToken) || !issuer || !audience)
    throw new Error('Hosted mode requires OAuth introspection URL, service token, issuer and audience');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new Error('OAuth introspection requires an HTTPS endpoint without credentials or fragment');
  // Authority is attached only to this request's authenticated object, never a saved proposal.
  const grants = new WeakMap<Profile, { expiresAt: number; profile: LocalProfile }>();
  return {
    authenticateToken: async (token: string): Promise<LocalProfile | null> => {
      if (!token || token.length > 8192 || /[\r\n]/u.test(token)) return null;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${serviceToken}`,
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const body = await response.text();
        if (body.length > 65536) return null;
        const claims = JSON.parse(body);
        const now = Date.now();
        if (
          claims?.active !== true ||
          !Number.isSafeInteger(claims.exp) ||
          claims.exp * 1000 <= now ||
          claims.iss !== issuer ||
          !(claims.aud === audience || (Array.isArray(claims.aud) && claims.aud.includes(audience))) ||
          (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf * 1000 > now)) ||
          typeof claims.scope !== 'string'
        )
          return null;
        const scopes = claims.scope.split(/\s+/u);
        if (!scopes.includes('support:technician') && !scopes.includes('support:reviewer')) return null;
        const profile: LocalProfile = {
          id: claims.sub,
          actorId: claims.sub,
          tenantId: claims.tenant_id,
          customerId: claims.customer_id,
          role: 'support',
          review: scopes.includes('support:reviewer'),
        };
        validateProfile(profile);
        grants.set(profile, { expiresAt: claims.exp * 1000, profile });
        return profile;
      } catch {
        return null;
      }
    },
    reviewerAuthority: (profile: Profile): LocalProfile | null => {
      const grant = grants.get(profile);
      return grant?.profile.review === true && grant.expiresAt > Date.now() ? grant.profile : null;
    },
  };
}
