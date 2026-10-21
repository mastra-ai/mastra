import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { readFactorySessionScope } from '../rules/binding-context.js';
import { SESSION_LINK_LABEL, sessionLink } from './channel-reply-processor.js';
import { NEW_CHANNEL_SESSION_KEY } from './channel-session-link-processor.js';
import { resolveRenderContext } from './share-file-tool.js';
import type { ShareFileToolDeps } from './share-file-tool.js';

export const REPLY_TOOL_NAME = 'reply_in_thread';

/** Set once the first reply of a new session carried the session link. */
const LINKED_KEY = 'factory__replyLinked';

const replyInput = z
  .object({
    text: z.string().trim().min(1).max(12_000).describe('The message to post, in markdown.'),
  })
  .strict();

/**
 * The only way a channel run speaks when the adapter hides reply text
 * (`textDisplay: 'hidden'`). Posting becomes a choice the agent makes, so it
 * stops narrating each step into the thread and can say nothing on purpose.
 * Offered only on runs whose chat thread hides text; elsewhere the reply
 * stream still posts and this tool would double every message.
 */
export async function createReplyTool(
  requestContext: RequestContext,
  deps: ShareFileToolDeps = {},
): Promise<IntegrationTools> {
  const render = await resolveRenderContext(requestContext, deps);
  if (render?.textDisplay !== 'hidden') return {};
  return {
    [REPLY_TOOL_NAME]: createTool({
      id: REPLY_TOOL_NAME,
      description:
        'Post a message in this chat thread. Nothing you write outside this tool reaches the thread, so use it for anything the people there should see: a short note that you are starting a longer job, a question you need answered, and the outcome when you finish. Post when you have something new; do not repeat yourself or post that nothing changed. To stay quiet, do not call it.',
      inputSchema: replyInput,
      execute: async input => {
        const link = firstReplyLink(requestContext);
        await render.chatThread.post({
          markdown: link ? `${input.text}\n\n[${SESSION_LINK_LABEL}](${link})` : input.text,
        });
        // Marked only once posted, so a failed first post still gets the link on the retry.
        if (link) requestContext.set(LINKED_KEY, true);
        return { posted: true };
      },
    }),
  };
}

/**
 * The session link the first reply of a new session ends with. With reply
 * text hidden, `FactoryChannelSessionLinkProcessor`'s text delta never
 * reaches the thread, so the tool carries the link instead.
 */
function firstReplyLink(requestContext: RequestContext): string | undefined {
  if (!requestContext.get(NEW_CHANNEL_SESSION_KEY) || requestContext.get(LINKED_KEY)) return undefined;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.threadId) return undefined;
  return sessionLink({
    threadId: controller.threadId,
    sessionId: controller.sessionId,
    resourceId: controller.resourceId,
    factoryProjectId: readFactorySessionScope(requestContext)?.factoryProjectId,
  });
}
