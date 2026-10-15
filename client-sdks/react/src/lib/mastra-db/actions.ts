import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { MastraAction } from '@mastra/core/new-message-format';
import type { ChunkType } from '@mastra/core/stream';
import { accumulateChunk, finishStreamingAssistantMessage } from './accumulator';

/**
 * Bridges action-native runs onto the chunk accumulator so Studio's rendering, approval
 * state, and callbacks keep working. Live streams build text from deltas; history replay
 * (`replay: true`) builds it from the finished actions instead.
 */
export const createActionChunker = ({ replay = false }: { replay?: boolean } = {}) => {
  const toolArgs = new Map<string, unknown>();

  return (action: MastraAction): ChunkType[] => {
    const runId = action.runId ?? '';
    const chunk = (type: string, payload: Record<string, unknown> = {}) =>
      ({ type, runId, from: 'AGENT', payload }) as unknown as ChunkType;

    switch (action.type) {
      case 'turn-start':
        // One assistant message per run: `start` dedupes on messageId across turns.
        return [chunk('start', { messageId: runId || action.id })];
      case 'text-start':
        return replay ? [] : [chunk('text-start', { id: action.contentId })];
      case 'text-delta':
        return replay ? [] : [chunk('text-delta', { id: action.contentId, text: action.delta })];
      case 'reasoning-start':
        return replay ? [] : [chunk('reasoning-start', { id: action.contentId })];
      case 'reasoning-delta':
        return replay ? [] : [chunk('reasoning-delta', { id: action.contentId, text: action.delta })];
      case 'text': {
        if (action.role !== 'assistant') return [];
        const id = action.contentId ?? action.id;
        return replay
          ? [chunk('text-start', { id }), chunk('text-delta', { id, text: action.text }), chunk('text-end', { id })]
          : [chunk('text-end', { id })];
      }
      case 'reasoning': {
        const id = action.contentId ?? action.id;
        return replay
          ? [
              chunk('reasoning-start', { id }),
              chunk('reasoning-delta', { id, text: action.text }),
              chunk('reasoning-end', { id }),
            ]
          : [chunk('reasoning-end', { id })];
      }
      case 'tool-input-start':
        return [chunk('tool-call-input-streaming-start', { toolCallId: action.toolCallId, toolName: action.toolName })];
      case 'tool-input-delta':
        return [chunk('tool-call-delta', { toolCallId: action.toolCallId, argsTextDelta: action.delta })];
      case 'tool-call':
        toolArgs.set(action.toolCallId, action.input);
        return [chunk('tool-call', { toolCallId: action.toolCallId, toolName: action.toolName, args: action.input })];
      case 'tool-approval-requested':
        return [
          chunk('tool-call-approval', {
            toolCallId: action.toolCallId,
            toolName: action.toolName,
            args: toolArgs.get(action.toolCallId),
          }),
        ];
      case 'tool-output-delta':
        return [
          chunk('tool-output', { toolCallId: action.toolCallId, toolName: action.toolName, output: action.output }),
        ];
      case 'tool-result':
        return [
          chunk('tool-result', { toolCallId: action.toolCallId, toolName: action.toolName, result: action.output }),
        ];
      case 'tool-error':
        return [
          chunk('tool-error', { toolCallId: action.toolCallId, toolName: action.toolName, error: action.errorText }),
        ];
      case 'tool-denied':
        return [chunk('tool-output-denied', { toolCallId: action.toolCallId, toolName: action.toolName })];
      case 'run-end':
        return [chunk('finish', { stepResult: { reason: action.finishReason } })];
      case 'run-aborted':
        return [chunk('abort')];
      case 'error':
        return action.retrying ? [] : [chunk('error', { error: action.error.message })];
      default:
        return [];
    }
  };
};

/** Rebuilds a thread's chat history from its stored actions. */
export const actionsToMessages = (actions: MastraAction[]): MastraDBMessage[] => {
  const toChunks = createActionChunker({ replay: true });
  let messages: MastraDBMessage[] = [];

  for (const action of actions) {
    if (action.type === 'text' && action.role === 'user') {
      messages = finishStreamingAssistantMessage(messages);
      const last = messages[messages.length - 1];
      // Consecutive user text in one run belongs to one message.
      if (last?.role === 'user' && last.id.startsWith(`${action.runId ?? action.id}-user`)) {
        messages[messages.length - 1] = {
          ...last,
          content: { ...last.content, parts: [...last.content.parts, { type: 'text', text: action.text }] },
        };
        continue;
      }
      messages.push({
        id: `${action.runId ?? action.id}-user-${action.id}`,
        role: 'user',
        createdAt: new Date(action.createdAt),
        threadId: action.threadId,
        resourceId: action.resourceId,
        content: { format: 2, parts: [{ type: 'text', text: action.text }] },
      });
      continue;
    }
    for (const chunk of toChunks(action)) {
      messages = accumulateChunk({ chunk, conversation: messages, metadata: { mode: 'stream', runId: action.runId } });
    }
  }
  return finishStreamingAssistantMessage(messages);
};
