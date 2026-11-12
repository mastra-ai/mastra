import { deepMergeWorkingMemory } from '@internal/core/memory';
import type { MastraDBMessage } from '../../agent/message-list';
import { mastraDBMessageToSignal } from '../../agent/signals';
import { isWorkingMemoryToolName } from '../../memory/working-memory-utils';

/** Reconstruct only state recorded before the turn, never the resource's current value. */
export function rebuildWorkingMemory(
  messages: MastraDBMessage[],
  beforeIndex: number,
  { mode }: { mode: 'markdown' | 'schema' },
): string | undefined {
  let value: string | undefined;
  for (const message of messages.slice(0, beforeIndex)) {
    if (message.role === 'signal') {
      const signal = mastraDBMessageToSignal(message);
      const state = signal.metadata?.state;
      if (state && typeof state === 'object' && 'id' in state && state.id === 'working-memory') {
        const snapshot = signal.metadata?.value;
        if (typeof snapshot === 'string') value = snapshot;
        else if ('mode' in state && state.mode === 'snapshot' && typeof signal.contents === 'string')
          value = signal.contents;
      }
    }
    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation') continue;
      const call = part.toolInvocation;
      if (!isWorkingMemoryToolName(call.toolName) || call.state !== 'result' || call.isError) continue;
      const patch: unknown = call.args?.memory;
      if (mode === 'markdown' && typeof patch === 'string') value = patch;
      if (mode === 'schema' && patch && typeof patch === 'object' && !Array.isArray(patch)) {
        value = JSON.stringify(
          deepMergeWorkingMemory(value ? JSON.parse(value) : undefined, patch as Record<string, unknown>),
        );
      }
    }
  }
  return value;
}
