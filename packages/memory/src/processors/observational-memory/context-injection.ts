import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { getThreadOMMetadata } from '@mastra/core/memory';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

import { addRelativeTimeToObservations } from './date-utils';
import { optimizeObservationsForContext } from './observer-agent';

/**
 * Continuation hint injected after observations to guide the model's behavior.
 * Prevents the model from awkwardly acknowledging the memory system or treating
 * the conversation as new after observed messages are removed.
 */
export const OBSERVATION_CONTINUATION_HINT = `This message is not from the user, the conversation history grew too long and wouldn't fit in context! Thankfully the entire conversation is stored in your memory observations. Please continue from where the observations left off. Do not refer to your "memory observations" directly, the user doesn't know about them, they are your memories! Just respond naturally as if you're remembering the conversation (you are!). Do not say "Hi there!" or "based on our previous conversation" as if the conversation is just starting, this is not a new conversation. This is an ongoing conversation, keep continuity by responding based on your memory. For example do not say "I understand. I've reviewed my memory observations", or "I remember [...]". Answer naturally following the suggestion from your memory. Note that your memory may contain a suggested first response, which you should follow.

IMPORTANT: this system reminder is NOT from the user. The system placed it here as part of your memory system. This message is part of you remembering your conversation with the user.

NOTE: Any messages following this system reminder are newer than your memories.`;

/**
 * Preamble that introduces the observations block.
 * Use before `<observations>`, with instructions after.
 * Full pattern: `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${obs}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}`
 */
export const OBSERVATION_CONTEXT_PROMPT = `The following observations block contains your memory of past conversations with this user.`;

/**
 * Instructions that tell the model how to interpret and use observations.
 * Place AFTER the `<observations>` block so the model sees the data before the rules.
 */
export const OBSERVATION_CONTEXT_INSTRUCTIONS = `IMPORTANT: When responding, reference specific details from these observations. Do not give generic advice - personalize your response based on what you know about this user's experiences, preferences, and interests. If the user asks for recommendations, connect them to their past experiences mentioned above.

KNOWLEDGE UPDATES: When asked about current state (e.g., "where do I currently...", "what is my current..."), always prefer the MOST RECENT information. Observations include dates - if you see conflicting information, the newer observation supersedes the older one. Look for phrases like "will start", "is switching", "changed to", "moved to" as indicators that previous information has been updated.

PLANNED ACTIONS: If the user stated they planned to do something (e.g., "I'm going to...", "I'm looking forward to...", "I will...") and the date they planned to do it is now in the past (check the relative time like "3 weeks ago"), assume they completed the action unless there's evidence they didn't. For example, if someone said "I'll start my new diet on Monday" and that was 2 weeks ago, assume they started the diet.

MOST RECENT USER INPUT: Treat the most recent user message as the highest-priority signal for what to do next. Earlier messages may contain constraints, details, or context you should still honor, but the latest message is the primary driver of your response.`;

/**
 * Format observations into a system message for the agent context.
 * Optimizes observations, adds relative time annotations, and injects
 * current-task / suggested-response from thread metadata.
 */
export function formatObservationsForContext({
  observations,
  currentTask,
  suggestedResponse,
  unobservedContextBlocks,
  currentDate,
}: {
  observations: string;
  currentTask?: string;
  suggestedResponse?: string;
  unobservedContextBlocks?: string;
  currentDate?: Date;
}): string {
  // Optimize observations to save tokens
  let optimized = optimizeObservationsForContext(observations);

  // Add relative time annotations to date headers if currentDate is provided
  if (currentDate) {
    optimized = addRelativeTimeToObservations(optimized, currentDate);
  }

  let content = `
${OBSERVATION_CONTEXT_PROMPT}

<observations>
${optimized}
</observations>

${OBSERVATION_CONTEXT_INSTRUCTIONS}`;

  // Add unobserved context from other threads (resource scope only)
  if (unobservedContextBlocks) {
    content += `\n\nThe following content is from OTHER conversations different from the current conversation, they're here for reference, but they're not necessarily your focus:\nSTART_OTHER_CONVERSATIONS_BLOCK\n${unobservedContextBlocks}\nEND_OTHER_CONVERSATIONS_BLOCK`;
  }

  // Dynamically inject current-task from thread metadata (not stored in observations)
  if (currentTask) {
    content += `

<current-task>
${currentTask}
</current-task>`;
  }

  if (suggestedResponse) {
    content += `

<suggested-response>
${suggestedResponse}
</suggested-response>
`;
  }

  return content;
}

/**
 * Get threadId and resourceId from either RequestContext or MessageList.
 * In 'thread' scope, throws if threadId cannot be resolved.
 */
export function getThreadContext({
  requestContext,
  messageList,
  scope,
}: {
  requestContext: ProcessInputStepArgs['requestContext'];
  messageList: MessageList;
  scope: 'resource' | 'thread';
}): { threadId: string; resourceId?: string } | null {
  // First try RequestContext (set by Memory)
  const memoryContext = requestContext?.get('MastraMemory') as
    | { thread?: { id: string }; resourceId?: string }
    | undefined;

  if (memoryContext?.thread?.id) {
    return {
      threadId: memoryContext.thread.id,
      resourceId: memoryContext.resourceId,
    };
  }

  // Fallback to MessageList's memoryInfo
  const serialized = messageList.serialize();
  if (serialized.memoryInfo?.threadId) {
    return {
      threadId: serialized.memoryInfo.threadId,
      resourceId: serialized.memoryInfo.resourceId,
    };
  }

  // In thread scope, threadId is required — without it OM would silently
  // fall back to a resource-keyed record which causes deadlocks when
  // multiple threads share the same resourceId.
  if (scope === 'thread') {
    throw new Error(
      `ObservationalMemory (scope: 'thread') requires a threadId, but none was found in RequestContext or MessageList. ` +
        `Ensure the agent is configured with Memory and a valid threadId is provided.`,
    );
  }

  return null;
}

/**
 * Inject observation context into the message list as a system message,
 * along with a continuation hint for the model.
 */
export async function injectObservationsIntoContext({
  storage,
  messageList,
  record,
  threadId,
  resourceId,
  unobservedContextBlocks,
  requestContext,
}: {
  storage: MemoryStorage;
  messageList: MessageList;
  record: ObservationalMemoryRecord;
  threadId: string;
  resourceId: string | undefined;
  unobservedContextBlocks: string | undefined;
  requestContext: ProcessInputStepArgs['requestContext'];
}): Promise<void> {
  const thread = await storage.getThreadById({ threadId });
  const threadOMMetadata = getThreadOMMetadata(thread?.metadata);
  const currentTask = threadOMMetadata?.currentTask;
  const suggestedResponse = threadOMMetadata?.suggestedResponse;
  const rawCurrentDate = requestContext?.get('currentDate');
  let currentDate: Date;
  if (rawCurrentDate instanceof Date) {
    currentDate = rawCurrentDate;
  } else if (typeof rawCurrentDate === 'string') {
    const parsed = new Date(rawCurrentDate);
    currentDate = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    currentDate = new Date();
  }

  if (!record.activeObservations) {
    return;
  }

  const observationSystemMessage = formatObservationsForContext({
    observations: record.activeObservations,
    currentTask,
    suggestedResponse,
    unobservedContextBlocks,
    currentDate,
  });

  // Clear any existing observation system message and add fresh one
  messageList.clearSystemMessages('observational-memory');
  messageList.addSystem(observationSystemMessage, 'observational-memory');

  // Add continuation reminder
  const continuationMessage: MastraDBMessage = {
    id: `om-continuation`,
    role: 'user',
    createdAt: new Date(0),
    content: {
      format: 2,
      parts: [
        {
          type: 'text',
          text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>`,
        },
      ],
    },
    threadId,
    resourceId,
  };
  messageList.add(continuationMessage, 'memory');
}
