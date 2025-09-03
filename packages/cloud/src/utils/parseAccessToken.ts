export function parseAccessToken(accessToken: string): { teamId: string; projectId: string; cloudEndpoint?: string } {
  const parts = accessToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'));

  const teamId = payload.teamId?.trim();
  const projectId = payload.projectId?.trim();

  if (!teamId || !projectId) {
    throw new Error('JWT missing teamId or projectId');
  }

  const cloudEndpoint = payload.cloudEndpoint?.trim() ?? undefined;
  return { teamId, projectId, cloudEndpoint };
}
