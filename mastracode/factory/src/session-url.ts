export function factorySessionUrl(
  uiOrigin: string,
  session: { factoryProjectId: string; sessionId: string; threadId: string },
): string {
  const origin = uiOrigin.replace(/\/+$/, '');
  return `${origin}/factories/${encodeURIComponent(session.factoryProjectId)}/workspaces/${encodeURIComponent(session.sessionId)}/threads/${encodeURIComponent(session.threadId)}`;
}
