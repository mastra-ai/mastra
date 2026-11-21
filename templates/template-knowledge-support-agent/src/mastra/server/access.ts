import { recordOperation } from '../observability.ts';
import { readFileSync } from 'node:fs';
import type { MastraAuthConfig } from '@mastra/core/server';
import { getWebRequest } from '@mastra/core/server';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '@mastra/server/server-adapter';
import type { Memory } from '@mastra/memory';
import { principals, resourceId, validateProfile } from '../identity.ts';
import type { Profile } from '../identity.ts';
import { authorizeConfirmation } from './confirmations.ts';
import { createStudioAccess } from './studio-access.ts';
import { createReviewAccess } from './review-access.ts';
import type { ReviewWorkflow } from '../workflows/review-workflow.ts';
import type { ReviewerAuthority } from '../review/service.ts';

export type LocalProfile = Profile & { role: string; review?: boolean };
export type CredentialSource = Credential[] | (() => Credential[]);
const currentCredentials = (source: CredentialSource) => (typeof source === 'function' ? source() : source);

export function createReviewerAuthority(source: CredentialSource) {
  return (profile: Profile): LocalProfile | null =>
    currentCredentials(source).find(
      entry =>
        entry.expiresAt > Date.now() &&
        entry.profile.review === true &&
        entry.profile.id === profile.id &&
        resourceId(entry.profile) === resourceId(profile),
    )?.profile ?? null;
}

export interface Credential {
  token: string;
  expiresAt: number;
  profile: LocalProfile;
}

export function loadCredentials(file: string, studioRole: string | undefined): Credential[] {
  if (!studioRole?.trim()) throw new Error('A local Studio role is required');

  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data) || !data.length) throw new Error('Local credentials are missing');
  return data.map(entry => {
    if (typeof entry.token !== 'string' || entry.token.length < 32 || !Number.isFinite(entry.expiresAt))
      throw new Error('Invalid local credentials');
    const profile = entry.profile;
    if (profile?.role !== studioRole) throw new Error('Invalid local role');
    validateProfile(profile);
    if (profile.review !== undefined && typeof profile.review !== 'boolean') throw new Error('Invalid review grant');
    return { token: entry.token, expiresAt: entry.expiresAt, profile };
  });
}

export function createSupportAuthorization(
  memory: Memory,
  reviewWorkflow: ReviewWorkflow,
  authority: ReviewerAuthority,
) {
  const authorizeStudioRoute = createStudioAccess(memory);
  const authorizeReviewRoute = createReviewAccess(reviewWorkflow, authority);
  return async (
    path: string,
    method: string,
    request: Request | undefined,
    profile: LocalProfile | null,
    requestContext: RequestContext,
  ) => {
    const started = performance.now();
    if (!profile || !request) {
      recordOperation('authorization', 'denied', started);
      return false;
    }

    const owner = resourceId(profile);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, owner);
    requestContext.set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, principals(profile));

    const review = await authorizeReviewRoute(path, method, request, owner, profile);
    const confirmation = await authorizeConfirmation(path, method, request, owner, memory);
    const allowed = confirmation ?? review ?? (await authorizeStudioRoute(path, method, request, owner));
    recordOperation('authorization', allowed ? 'success' : 'denied', started);
    return allowed;
  };
}

export type SupportAuthorization = ReturnType<typeof createSupportAuthorization>;

type AuthorizationRequest = Request | { raw?: Request; header?(name: string): string | undefined };

export function bearerToken(request: AuthorizationRequest): string | undefined {
  const header =
    request instanceof Request
      ? request.headers.get('authorization')
      : (request.header?.('authorization') ?? request.raw?.headers.get('authorization'));
  return header?.match(/^Bearer +(.+)$/iu)?.[1];
}

export function createAuth(
  credentials: CredentialSource,
  authorize: SupportAuthorization,
  authenticateToken = async (token: string) =>
    currentCredentials(credentials).find(entry => entry.token === token && entry.expiresAt > Date.now())?.profile ??
    null,
) {
  const authorizeRequest: NonNullable<MastraAuthConfig<LocalProfile | null>['authorize']> = (
    path,
    method,
    profile,
    context,
  ) => authorize(path, method, getWebRequest(context.req), profile, context.get('requestContext'));

  return {
    // The adapter strips only the literal prefix. Read the original header when it is Bearer.
    authenticateToken: (token: string, request?: AuthorizationRequest) =>
      authenticateToken((request && bearerToken(request)) ?? token),
    mapUserToResourceId: (profile: LocalProfile | null) => (profile ? resourceId(profile) : undefined),
    getCurrentUser: async (request: Request) => {
      const token = bearerToken(request);
      return token ? authenticateToken(token) : null;
    },
    authorize: authorizeRequest,
  };
}
