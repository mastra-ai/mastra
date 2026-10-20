import type { ProcessInputStepArgs, Processor } from '@mastra/core/processors';

const ID = 'factory-channel-reply';

export const SESSION_LINK_LABEL = 'Open session ↗';

/**
 * Tells the agent how to open a reply when the run came in over a chat
 * channel (Slack, …): acknowledge a job in one line that names it — "On it —
 * sleeping 30s, then running the echo" — before starting, so the sender sees
 * a task-specific first message rather than a silent typing status until the
 * first tool finishes. The channel driver posts that opener on its own before
 * the tool widget, so the instruction and the rendering agree. The session
 * link is not the model's job: `FactoryChannelSessionLinkProcessor` appends it
 * to the first reply of a new session, so it is there whether or not the
 * model judged the request worth an opener. No-op for runs without channel
 * context (Studio, API, boards).
 */
export class FactoryChannelReplyProcessor implements Processor {
  readonly id = ID;

  processInputStep({ messageList, requestContext }: ProcessInputStepArgs) {
    if (!requestContext?.get('channel')) return undefined;
    messageList.addSystem(
      {
        role: 'system',
        content: [
          'When a request will take tools or more than a moment to answer, reply first with one short line that says what you are about to do — "On it — <the task in a few words>." — then do the work; the opener posts as its own message before any progress is shown. Give direct answers and trivial replies without an opener.',
          'Finish with the outcome, not a replay of the steps.',
        ].join('\n'),
      },
      ID,
    );
    return { messageList };
  }
}

export interface SessionLinkTarget {
  threadId: string;
  resourceId: string;
  factoryProjectId?: string;
}

/**
 * The web URL for a session, or undefined without a public origin. Same
 * routes the Factory UI navigates to: a repo-backed thread's resourceId is the
 * Factory user-session id and doubles as the workspace segment; chat-only
 * threads keep the literal `channel` segment and name their resource in the
 * query; a session with no factory falls back to the factory-agnostic
 * /threads/ redirect, which forwards the query through.
 */
export function sessionLink({ threadId, resourceId, factoryProjectId }: SessionLinkTarget): string | undefined {
  const origin = process.env.MASTRACODE_PUBLIC_URL;
  if (!origin) return undefined;
  const isChatOnly = resourceId.startsWith('channel:');
  const resourceParam = `?resourceId=${encodeURIComponent(resourceId)}`;
  if (!factoryProjectId) return `${origin}/threads/${encodeURIComponent(threadId)}${resourceParam}`;
  const workspaceSegment = isChatOnly ? 'channel' : encodeURIComponent(resourceId);
  return `${origin}/factories/${encodeURIComponent(factoryProjectId)}/workspaces/${workspaceSegment}/threads/${encodeURIComponent(threadId)}${isChatOnly ? resourceParam : ''}`;
}
