import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { ProcessInputStepArgs, Processor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import { readFactorySessionScope } from '../rules/binding-context.js';

const ID = 'factory-channel-reply';

export const SESSION_LINK_LABEL = '↗';

/**
 * Tells the agent how to open a reply when the run came in over a chat
 * channel (Slack, …): acknowledge a job in one line that names it — "On it —
 * sleeping 30s, then running the echo" — before starting, so the sender sees
 * a task-specific first message rather than a silent typing status until the
 * first tool finishes. The channel driver posts that opener on its own before
 * the tool widget, so the instruction and the rendering agree. When the
 * session has a public URL the opener carries it as a trailing link, the way
 * other Slack agents sign their replies. No-op for runs without channel
 * context (Studio, API, boards).
 */
export class FactoryChannelReplyProcessor implements Processor {
  readonly id = ID;

  processInputStep({ messageList, requestContext }: ProcessInputStepArgs) {
    if (!requestContext?.get('channel')) return undefined;
    const link = sessionLink(requestContext);
    messageList.addSystem(
      {
        role: 'system',
        content: [
          'When a request will take tools or more than a moment to answer, reply first with one short line that says what you are about to do — "On it — <the task in a few words>." — then do the work; the opener posts as its own message before any progress is shown. Give direct answers and trivial replies without an opener.',
          link
            ? `End that opener with a link to this session, exactly: [${SESSION_LINK_LABEL}](${link}). Do not add the link anywhere else.`
            : undefined,
          'Finish with the outcome, not a replay of the steps.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      ID,
    );
    return { messageList };
  }
}

/**
 * The web URL for this session, or undefined without a public origin or a
 * thread. Same routes the Factory UI navigates to: a repo-backed thread's
 * resourceId is the Factory user-session id and doubles as the workspace
 * segment; chat-only threads keep the literal `channel` segment and name their
 * resource in the query; a session with no factory falls back to the
 * factory-agnostic /threads/ redirect, which forwards the query through.
 */
export function sessionLink(requestContext: RequestContext): string | undefined {
  const origin = process.env.MASTRACODE_PUBLIC_URL;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!origin || !controller?.threadId || !controller.resourceId) return undefined;
  const { threadId, resourceId } = controller;
  const factoryProjectId = readFactorySessionScope(requestContext)?.factoryProjectId;
  const isChatOnly = resourceId.startsWith('channel:');
  const resourceParam = `?resourceId=${encodeURIComponent(resourceId)}`;
  if (!factoryProjectId) return `${origin}/threads/${encodeURIComponent(threadId)}${resourceParam}`;
  const workspaceSegment = isChatOnly ? 'channel' : encodeURIComponent(resourceId);
  return `${origin}/factories/${encodeURIComponent(factoryProjectId)}/workspaces/${workspaceSegment}/threads/${encodeURIComponent(threadId)}${isChatOnly ? resourceParam : ''}`;
}
