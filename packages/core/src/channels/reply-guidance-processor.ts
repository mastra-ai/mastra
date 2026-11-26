import type { ProcessInputStepArgs, Processor } from '../processors';
import { REPLY_TOOL_NAME } from './reply-tool';

const ID = 'channel-reply-guidance';

/** Chat surfaces show what the agent writes as-is, so a bare id is a dead end for the reader. */
const LINK_REFERENCES =
  "Write every pull request, issue, commit, ticket or other reference you mention in the thread as a markdown link to its page, with the id as plain link text, e.g. [#28467](https://github.com/<owner>/<repo>/pull/28467). Never leave one as a bare id or wrap it in code formatting. Build links from URLs your tools returned; don't guess a URL, and leave a reference unlinked only when you can't work out its URL.";

/** Agents tend to write the way they report to other agents: names, ids and shorthand only they follow. */
const WRITE_FOR_PEOPLE = [
  'Write for the people in the thread, not for another agent. A teammate who knows the product and programming, but has not read this code or this conversation, should follow your message on first read.',
  'Lead with the answer or the outcome and anything you need from them, in plain sentences. Keep it short: a few sentences answer most questions, and when there is more, offer it rather than writing it all out. Say what code does rather than naming the function, file, field, error class or tool that does it; name one only when they need it to find the code. Use the project’s real terms, not invented analogies.',
  'Leave out tool names and run ids unless someone asks for them, and always leave out agent shorthand. When you pass on what another agent reported, say what it means for the people here in your own words; never paste its report.',
].join(' ');

export interface ChannelReplyGuidanceOptions {
  /**
   * Host-specific lines appended to the guidance, e.g. which links the host posts for the agent.
   * A function gets whether the run has `reply_in_thread`.
   */
  instructions?: string[] | ((run: { canReply: boolean }) => string[]);
}

/**
 * Tells the agent how to speak in a chat channel: open a long job with one line that names it,
 * finish with the outcome, write for people, and link references. With `reply_in_thread` on the
 * run, that advice becomes advice on when to call it. A run outside the channel that can still
 * post there (a web prompt on a linked thread) gets a short note on when to. Runs with neither
 * get nothing.
 */
export class ChannelReplyGuidanceProcessor implements Processor {
  readonly id = ID;
  readonly #instructions: ChannelReplyGuidanceOptions['instructions'];

  constructor(options: ChannelReplyGuidanceOptions = {}) {
    this.#instructions = options.instructions;
  }

  processInputStep({ messageList, requestContext, tools }: ProcessInputStepArgs) {
    const canReply = !!tools && REPLY_TOOL_NAME in tools;
    let content: string[];
    if (!requestContext?.get('channel')) {
      if (!canReply) return undefined;
      content = [
        `Post to that thread with \`${REPLY_TOOL_NAME}\`. This request came from outside it, so don't post an opener or progress there; post the outcome when the people in the thread asked for this work or are waiting on it, or when you're asked to. Don't write a note about what you posted.`,
      ];
    } else if (canReply) {
      content = [
        `Only messages you send with \`${REPLY_TOOL_NAME}\` reach this thread; your other text stays out of it. Don't write a note about what you posted. After a reply, either keep working or end your turn with an empty message; any text you write after posting is wasted.`,
        'When a request will take tools or more than a moment, post one short line first that says what you are about to do, then do the work and post the outcome when you finish — not a replay of the steps.',
        "Post again in between only when you need an answer or have news the people in the thread would want. When a message that doesn't mention you needs nothing from you, don't call it.",
      ];
    } else {
      content = [
        'When a request will take tools or more than a moment to answer, reply first with one short line that says what you are about to do — "On it — <the task in a few words>." — then do the work; the opener posts as its own message before any progress is shown. Give direct answers and trivial replies without an opener.',
        'Finish with the outcome, not a replay of the steps.',
      ];
    }
    const extra =
      typeof this.#instructions === 'function' ? this.#instructions({ canReply }) : (this.#instructions ?? []);
    messageList.addSystem(
      { role: 'system', content: [...content, ...extra, LINK_REFERENCES, WRITE_FOR_PEOPLE].join('\n') },
      ID,
    );
    return { messageList };
  }
}
