import type { ProcessInputStepArgs, Processor } from '@mastra/core/processors';

/** Mirrors `REPLY_TOOL_NAME` in `reply-tool.ts`, which imports this module. */
const REPLY_TOOL = 'reply_in_thread';

const ID = 'factory-channel-reply';

export const SESSION_LINK_LABEL = 'Open session ↗';

/**
 * Chat surfaces show what the agent writes as-is, so a bare `#28467`,
 * `FACT-526` or `52db47cd` is a dead end for the reader. Every channel run
 * gets this, whether it speaks in reply text or through the reply tool.
 */
const LINK_REFERENCES = [
  'Write every pull request, issue, commit, Linear ticket or other reference you mention in the thread as a markdown link to its page, with the ID as plain link text: [#28467](https://github.com/<owner>/<repo>/pull/28467), [52db47cd](https://github.com/<owner>/<repo>/commit/52db47cd), [FACT-526](<the ticket URL>). Never leave one as a bare ID or wrap it in code formatting.',
  "Build GitHub and GitLab links from the repository the reference belongs to, from the repositories listed in your environment or a tool result; with more than one repository, don't assume which one a bare number belongs to. Build Linear links from the workspace URL pattern in the `linear_get_issue` tool description, or from a URL a tool returned. Don't guess a URL; leave a reference unlinked only when you can't work out its URL.",
].join('\n');

/**
 * Tells the agent how to open a reply when the run came in over a chat
 * channel (Slack, …): acknowledge a job in one line that names it — "On it —
 * sleeping 30s, then running the echo" — before starting, so the sender sees
 * a task-specific first message rather than a silent typing status until the
 * first tool finishes. The channel driver posts that opener on its own before
 * the tool widget, so the instruction and the rendering agree. The session
 * link is not the model's job: `FactoryChannelSessionLinkProcessor` appends it
 * to the first reply of a new session, so it is there whether or not the
 * model judged the request worth an opener. A run on a Slack-linked session
 * that didn't start from Slack gets a shorter note on when to post there; runs
 * with no channel at all (Studio, API, boards) get nothing.
 */
export class FactoryChannelReplyProcessor implements Processor {
  readonly id = ID;

  processInputStep({ messageList, requestContext, tools }: ProcessInputStepArgs) {
    if (!requestContext?.get('channel')) {
      // A run on a Slack-linked session that didn't start from a Slack message
      // (a web prompt, a woken run) still has the reply tool; core's channel
      // prompt says the thread is linked, this says how to use it.
      if (!tools || !(REPLY_TOOL in tools)) return undefined;
      messageList.addSystem(
        {
          role: 'system',
          content: `Post to that thread with \`${REPLY_TOOL}\`. This request came from outside it, so don't post an opener or progress there; post the outcome when the people in the thread asked for this work or are waiting on it, or when you're asked to. Don't write a note about what you posted. When you open a pull request, its link is posted to this thread for you, and again when it merges, so don't post the link yourself.\n${LINK_REFERENCES}`,
        },
        ID,
      );
      return { messageList };
    }
    // With reply text hidden the thread only sees what the reply tool posts,
    // so the opener advice becomes advice about when to call it.
    const content =
      tools && REPLY_TOOL in tools
        ? [
            `Only messages you send with \`${REPLY_TOOL}\` reach this thread; your other text stays in the session. Don't write a note about what you posted. After a reply, either keep working or end your turn with an empty message; any text you write after posting is wasted.`,
            `When a request will take tools or more than a moment, post one short line first that says what you are about to do, then do the work and post the outcome when you finish — not a replay of the steps.`,
            `Post again in between only when you need an answer or have news the people in the thread would want. When a message needs nothing from you, don't call it.`,
            `When you open a pull request, its link is posted to this thread for you, and again when it merges, so don't post the link yourself.`,
          ]
        : [
            'When a request will take tools or more than a moment to answer, reply first with one short line that says what you are about to do — "On it — <the task in a few words>." — then do the work; the opener posts as its own message before any progress is shown. Give direct answers and trivial replies without an opener.',
            'Finish with the outcome, not a replay of the steps.',
          ];
    messageList.addSystem({ role: 'system', content: [...content, LINK_REFERENCES].join('\n') }, ID);
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
