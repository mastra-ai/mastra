import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { revealReply } from './conversation-playback';
import type { PlaybackTurn } from './conversation-playback';

/** Adapt saved result fields to Studio chat messages without inventing live execution state. */
export function conversationMessages(turn: PlaybackTurn, fraction: number): MastraDBMessage[] {
  const userText =
    typeof turn.input === 'string' ? turn.input : JSON.stringify(turn.input ?? 'User message unavailable', null, 2);
  const messages: MastraDBMessage[] = [
    {
      id: 'user',
      role: 'user',
      createdAt: new Date(0),
      content: { format: 2, parts: [{ type: 'text', text: userText }] },
    },
  ];
  if (!turn.executed || fraction === 0) return messages;

  const parts: MastraMessagePart[] = turn.toolCalls.map((call, index) => ({
    type: 'tool-invocation',
    toolInvocation: {
      toolCallId: `tool-${index}`,
      toolName: call.toolName,
      args: call.args ?? {},
      state: 'result' in call ? 'result' : 'call',
      ...('result' in call ? { result: call.result } : {}),
      ...(call.isError ? { state: 'output-error', isError: true } : {}),
    },
  }));
  if (turn.text) parts.push({ type: 'text', text: revealReply(turn.text, fraction) || '…' });
  if (parts.length > 0) {
    messages.push({ id: 'assistant', role: 'assistant', createdAt: new Date(0), content: { format: 2, parts } });
  }
  return messages;
}
