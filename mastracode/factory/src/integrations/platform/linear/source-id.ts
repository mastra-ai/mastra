export function encodeSourceId(workspaceId: string, projectId: string): string {
  return `linear-project:${Buffer.from(JSON.stringify({ workspaceId, projectId })).toString('base64url')}`;
}

export function decodeSourceId(sourceId: string): { workspaceId: string; projectId: string } {
  if (!sourceId.startsWith('linear-project:')) throw new Error('Linear project source id is invalid.');
  try {
    const parsed = JSON.parse(Buffer.from(sourceId.slice('linear-project:'.length), 'base64url').toString('utf8')) as {
      workspaceId?: unknown;
      projectId?: unknown;
    };
    if (typeof parsed.workspaceId !== 'string' || !parsed.workspaceId) throw new Error();
    if (typeof parsed.projectId !== 'string' || !parsed.projectId) throw new Error();
    return { workspaceId: parsed.workspaceId, projectId: parsed.projectId };
  } catch {
    throw new Error('Linear project source id is invalid.');
  }
}
