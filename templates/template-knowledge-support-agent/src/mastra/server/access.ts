import { readFileSync } from 'node:fs';
import type { MastraAuthConfig } from '@mastra/core/server';
import { getWebRequest } from '@mastra/core/server';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '@mastra/server/server-adapter';
import type { Memory } from '@mastra/memory';
import { principals, resourceId, validateProfile } from '../identity.ts';
import type { Profile } from '../identity.ts';
import { createStudioAccess } from './studio-access.ts';

export type LocalProfile = Profile & { role: string };

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
    return { token: entry.token, expiresAt: entry.expiresAt, profile };
  });
}

export function createAuth(credentials: Credential[], memory: Memory) {
  const authenticateToken = async (token: string) =>
    credentials.find(entry => entry.token === token && entry.expiresAt > Date.now())?.profile ?? null;
  const authorizeStudioRoute = createStudioAccess(memory);
  const authorize: NonNullable<MastraAuthConfig<LocalProfile | null>['authorize']> = async (
    path,
    method,
    profile,
    context,
  ) => {
    const request = getWebRequest(context.req);
    if (!profile || !request) return false;

    const owner = resourceId(profile);
    const requestContext = context.get('requestContext');
    requestContext.set(MASTRA_RESOURCE_ID_KEY, owner);
    requestContext.set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, principals(profile));

    return authorizeStudioRoute(path, method, request, owner);
  };

  return {
    authenticateToken,
    mapUserToResourceId: (profile: LocalProfile | null) => (profile ? resourceId(profile) : undefined),
    getCurrentUser: async (request: Request) => {
      const header = request.headers.get('authorization');
      return header?.startsWith('Bearer ') ? authenticateToken(header.slice(7)) : null;
    },
    authorize,
  };
}
