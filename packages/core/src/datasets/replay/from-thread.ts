import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory } from '../../memory';
import { isWorkingMemoryToolName } from '../../memory/working-memory-utils';
import type { DatasetItemPayload } from '../../storage/types';
import type { DataItem } from '../experiment/types';
import type { ConversationReplayInput } from './conversation';
import { rebuildWorkingMemory } from './working-memory';

export type ReplayMessage = Omit<MastraDBMessage, 'id' | 'threadId' | 'resourceId' | 'createdAt'> & {
  createdAt: string;
};

export type ReplayItemInput = DataItem<ReplayMessage[], string> &
  Pick<DatasetItemPayload, 'source'> & {
    metadata: {
      replay: {
        sourceThreadId: string;
        sourceResourceId: string;
        turnIndex: number;
        turnCount: number;
        sourceMessageId: string;
        unresolvedToolCalls: string[];
      };
    };
  };

export const replayHistoryLimitSchema = z.union([z.number().int().nonnegative(), z.literal(false)]);

/**
 * Prior messages each independent turn receives when the caller sets no `historyLimit`.
 * Memory `lastMessages: false` disables recall, so production saw no history: map it to 0.
 * Replay `historyLimit: false` means "all prior messages" and is never implied by memory config.
 */
export function defaultReplayHistoryLimit(memory: Pick<MastraMemory, 'getMergedThreadConfig'>): number {
  const lastMessages = memory.getMergedThreadConfig().lastMessages;
  return lastMessages === false ? 0 : (lastMessages ?? 10);
}

export type ConversationReplayItemInput = DataItem<ConversationReplayInput, never> &
  Pick<DatasetItemPayload, 'source'> & {
    metadata: {
      replay: {
        mode: 'conversation';
        sourceThreadId: string;
        sourceResourceId: string;
        turnCount: number;
        turns: Pick<ReplayItemInput['metadata']['replay'], 'turnIndex' | 'sourceMessageId' | 'unresolvedToolCalls'>[];
      };
    };
  };

const replayOptionsSchema = z
  .object({
    mode: z.enum(['turns', 'conversation']).optional(),
    historyLimit: replayHistoryLimitSchema.optional(),
  })
  .refine(options => options.mode !== 'conversation' || options.historyLimit === undefined, {
    path: ['historyLimit'],
    message:
      'historyLimit is only supported for independent turns; conversation replay uses the candidate memory configuration.',
  });

type ReplayOptions = {
  memory: MastraMemory;
  threadId: string;
  resourceId?: string;
  /** Prior messages per independent item; defaults to memory.lastMessages. false includes all. */
  historyLimit?: number | false;
  mode?: 'turns' | 'conversation';
};

export function datasetItemsFromThread(options: ReplayOptions & { mode?: 'turns' }): Promise<ReplayItemInput[]>;
export function datasetItemsFromThread(
  options: ReplayOptions & { mode: 'conversation' },
): Promise<ConversationReplayItemInput[]>;
export function datasetItemsFromThread(
  options: ReplayOptions,
): Promise<(ReplayItemInput | ConversationReplayItemInput)[]>;
/** Convert a stored thread into independent turns (default) or one continuous conversation. */
export async function datasetItemsFromThread({
  memory,
  threadId,
  resourceId,
  historyLimit,
  mode = 'turns',
}: ReplayOptions): Promise<(ReplayItemInput | ConversationReplayItemInput)[]> {
  replayOptionsSchema.parse({ mode, historyLimit });
  const config = memory.getMergedThreadConfig();
  const limit = replayHistoryLimitSchema.parse(historyLimit ?? defaultReplayHistoryLimit(memory));
  const store = await memory.storage.getStore('memory');
  if (!store) throw new Error('Memory storage is required to replay a thread.');
  const thread = await store.getThreadById({ threadId });
  if (!thread || (resourceId !== undefined && thread.resourceId !== resourceId))
    throw new Error('Replay source thread not found.');
  const messages: MastraDBMessage[] = [];
  for (let page = 0; ; page++) {
    const batch = await store.listMessages({
      threadId,
      resourceId: thread.resourceId,
      page,
      perPage: 100,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    messages.push(...batch.messages);
    if (!batch.hasMore) break;
  }
  const starts = messages.flatMap((message, index) => (message.role === 'user' ? [index] : []));
  const items: ReplayItemInput[] = [];
  for (const [turnIndex, start] of starts.entries()) {
    const turn = messages.slice(start, starts[turnIndex + 1]);
    const assistant = turn.findLast(message => message.role === 'assistant');
    const reply =
      assistant?.content.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('') ?? '';
    if (turnIndex === starts.length - 1 && !reply) continue;
    const calls = turn.flatMap(message =>
      message.content.parts.flatMap(part => (part.type === 'tool-invocation' ? [part.toolInvocation] : [])),
    );
    // Input processors persist their entry-state signals after the user message.
    // Include those signals, stopping before the agent can update working memory.
    const firstAssistantIndex = turn.findIndex(message => message.role === 'assistant');
    const seedBoundary = start + (firstAssistantIndex < 0 ? 1 : firstAssistantIndex);
    const workingMemory =
      config.workingMemory?.enabled && (mode === 'turns' || items.length === 0)
        ? rebuildWorkingMemory(messages, seedBoundary, { mode: config.workingMemory.schema ? 'schema' : 'markdown' })
        : undefined;
    items.push({
      input: messages
        .slice(mode === 'conversation' ? start : limit === false ? 0 : Math.max(0, start - limit), start + 1)
        .map(({ id: _id, threadId: _threadId, resourceId: _resourceId, createdAt, ...message }) => ({
          ...structuredClone(message),
          createdAt: createdAt.toISOString(),
        })),
      groundTruth: reply,
      expectedTrajectory: {
        ordering: 'strict',
        steps: calls.map(call => ({
          stepType: 'tool_call',
          name: call.toolName,
          toolArgs: call.args,
          toolResult: call.result,
        })),
      },
      toolMocks: calls
        .filter(
          call => !isWorkingMemoryToolName(call.toolName) && call.state === 'result' && Object.hasOwn(call, 'result'),
        )
        .map(call => ({
          toolName: call.toolName,
          args: call.args,
          output: call.result,
          ...(call.toolName.startsWith('agent-') ? { matchArgs: 'ignore' as const } : {}),
        })),
      ...(workingMemory !== undefined ? { memorySeed: { workingMemory } } : {}),
      unmockedToolPolicy: 'deny',
      toolMockMatchMode: 'lookup',
      metadata: {
        replay: {
          sourceThreadId: threadId,
          sourceResourceId: thread.resourceId,
          turnIndex,
          turnCount: 0,
          sourceMessageId: messages[start]!.id,
          unresolvedToolCalls: calls
            .filter(call => call.state !== 'result' || !Object.hasOwn(call, 'result'))
            .map(call => call.toolCallId),
        },
      },
      source: { type: 'thread', referenceId: threadId },
    });
  }
  for (const item of items) item.metadata.replay.turnCount = items.length;
  // Stored messages can carry optional undefined fields. Normalize them once to
  // the JSON representation used by dataset storage and HTTP clients.
  const result =
    mode === 'conversation' && items.length
      ? [
          {
            input: {
              type: 'conversation' as const,
              turns: items.map(({ input, groundTruth, expectedTrajectory, toolMocks }) => ({
                input,
                groundTruth,
                expectedTrajectory,
                toolMocks,
              })),
            },
            ...(items[0]!.memorySeed ? { memorySeed: items[0]!.memorySeed } : {}),
            toolMockMatchMode: 'lookup' as const,
            unmockedToolPolicy: 'deny' as const,
            source: items[0]!.source,
            metadata: {
              replay: {
                mode: 'conversation' as const,
                sourceThreadId: threadId,
                sourceResourceId: thread.resourceId,
                turnCount: items.length,
                turns: items.map(({ metadata: { replay } }) => ({
                  turnIndex: replay.turnIndex,
                  sourceMessageId: replay.sourceMessageId,
                  unresolvedToolCalls: replay.unresolvedToolCalls,
                })),
              },
            },
          },
        ]
      : items;
  return JSON.parse(JSON.stringify(result)) as (ReplayItemInput | ConversationReplayItemInput)[];
}
