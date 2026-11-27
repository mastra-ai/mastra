import { factorySettingsUrl, factoryUiOrigin } from '../../links.js';

export const SESSION_LINK_LABEL = 'Open session ↗';

/**
 * Factory's lines on top of core's channel reply guidance: pull request links are posted for the
 * agent (a merge wakes the session without `channel`, so woken runs need this too), and how to
 * build links to GitHub, Linear and Factory's own work items.
 */
export function factoryReplyInstructions({ canReply }: { canReply: boolean }): string[] {
  return [
    ...(canReply
      ? [
          "When you open a pull request, its link is posted to this thread for you, and again when it merges, so don't post the link yourself.",
        ]
      : []),
    'Agent shorthand includes checkpoint counts and RED → GREEN or STOPPED.',
    "Build GitHub and GitLab links from the repository the reference belongs to, from the repositories listed in your environment or a tool result; with more than one repository, don't assume which one a bare number belongs to. Build Linear links from the workspace URL pattern in the `linear_get_issue` tool description, or from a URL a tool returned.",
    'Link Factory work items and sessions with the `url` the Factory tools return: [#123](<item url>). When something needs a person, ask them for it here and link the item; only send them to the web UI when the channel cannot do it, and then link the exact page.',
  ];
}

export interface SessionLinkTarget {
  threadId: string;
  sessionId: string;
  resourceId: string;
  factoryProjectId?: string;
}

/**
 * The web URL for a session, or undefined without a public origin. Same
 * routes the Factory UI navigates to: a repo-backed thread's Factory session
 * id is the workspace segment; chat-only threads keep the literal `channel`
 * segment and name their session in the query; a session with no factory
 * falls back to the factory-agnostic /threads/ redirect, which forwards the
 * query through.
 */
export function sessionLink({
  threadId,
  sessionId,
  resourceId,
  factoryProjectId,
}: SessionLinkTarget): string | undefined {
  const origin = factoryUiOrigin();
  if (!origin) return undefined;
  const isChatOnly = resourceId.startsWith('channel:');
  const sessionParam = `?sessionId=${encodeURIComponent(sessionId)}`;
  if (!factoryProjectId) return `${origin}/threads/${encodeURIComponent(threadId)}${sessionParam}`;
  const workspaceSegment = isChatOnly ? 'channel' : encodeURIComponent(sessionId);
  return `${origin}/factories/${encodeURIComponent(factoryProjectId)}/workspaces/${workspaceSegment}/threads/${encodeURIComponent(threadId)}${isChatOnly ? sessionParam : ''}`;
}

export function modelSettingsLink(factoryProjectId: string): string | undefined {
  return factorySettingsUrl(factoryProjectId, 'models');
}

export function memorySettingsLink(factoryProjectId: string): string | undefined {
  return factorySettingsUrl(factoryProjectId, 'memory');
}

/** `VOICE_INPUT_ANCHOR` in factory-ui's `settingsSections.ts`; the voice section scrolls itself into view on this hash. */
export function voiceSettingsLink(factoryProjectId: string): string | undefined {
  const models = modelSettingsLink(factoryProjectId);
  return models && `${models}#voice-input`;
}
