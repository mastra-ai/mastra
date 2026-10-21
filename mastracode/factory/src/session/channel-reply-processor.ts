import type { ProcessInputStepArgs, Processor } from '@mastra/core/processors';

/** Mirrors `REPLY_TOOL_NAME` in `reply-tool.ts`, which imports this module. */
const REPLY_TOOL = 'reply_in_thread';

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

  processInputStep({ messageList, requestContext, tools }: ProcessInputStepArgs) {
    if (!requestContext?.get('channel')) return undefined;
    // With reply text hidden the thread only sees what the reply tool posts,
    // so the opener advice becomes advice about when to call it.
    const content =
      tools && REPLY_TOOL in tools
        ? [
            `Only messages you send with \`${REPLY_TOOL}\` reach this thread; your other text stays in the session.`,
            `When a request will take tools or more than a moment, post one short line first that says what you are about to do, then do the work and post the outcome when you finish — not a replay of the steps.`,
            `Post again in between only when you need an answer or have news the people in the thread would want. When a message needs nothing from you, call \`${REPLY_TOOL}\` with \`staySilent: true\`.`,
          ]
        : [
            'When a request will take tools or more than a moment to answer, reply first with one short line that says what you are about to do — "On it — <the task in a few words>." — then do the work; the opener posts as its own message before any progress is shown. Give direct answers and trivial replies without an opener.',
            'Finish with the outcome, not a replay of the steps.',
          ];
    messageList.addSystem({ role: 'system', content: content.join('\n') }, ID);
    return { messageList };
  }
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
  const origin = process.env.MASTRACODE_PUBLIC_URL;
  if (!origin) return undefined;
  const isChatOnly = resourceId.startsWith('channel:');
  const sessionParam = `?sessionId=${encodeURIComponent(sessionId)}`;
  if (!factoryProjectId) return `${origin}/threads/${encodeURIComponent(threadId)}${sessionParam}`;
  const workspaceSegment = isChatOnly ? 'channel' : encodeURIComponent(sessionId);
  return `${origin}/factories/${encodeURIComponent(factoryProjectId)}/workspaces/${workspaceSegment}/threads/${encodeURIComponent(threadId)}${isChatOnly ? sessionParam : ''}`;
}
