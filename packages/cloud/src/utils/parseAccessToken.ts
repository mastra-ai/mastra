import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';

export function parseAccessToken(accessToken: string): { teamId: string; projectId: string; cloudEndpoint?: string } {
  const parts = accessToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'));

  const { teamId, projectId } = payload;

  if (!teamId || !projectId) {
    throw new Error('JWT missing teamId or projectId');
  }

  const cloudEndpoint = payload.cloudEndpoint ?? undefined;
  return { teamId, projectId, cloudEndpoint };
}
