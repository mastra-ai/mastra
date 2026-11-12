import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { MessageFactoryPart } from '@mastra/react/ui';
import { isToolPart, readToolPart } from '../messages/renderers/tool-part';
import { getSignalType, isRecord, isSignalData, isUserSignalType, toReactiveSignalData } from '../messages/signal-data';
import type { SignalData } from '../messages/signal-data';
import { isDeferredCall } from '../tools/tool-card-kind';
import { processExitNotice } from './background-notices';
import type { ProcessExitNotice } from './background-notices';
import { backgroundProcessPid } from './background-process';

/** A background `execute_command` call: the process it started and the workspace it ran in. */
export interface BackgroundCommand {
  toolCallId: string;
  pid: string;
  /** From the call's `workspace-metadata` part; absent when the call wrote none. */
  workspaceId?: string;
}

export interface ThreadBackgroundWork {
  commands: BackgroundCommand[];
  /** Exit notices, keyed by the tool call that started the process (or by PID when the notice names no call). */
  exits: Map<string, ProcessExitNotice>;
  /** Whether a call in the thread still runs as a Mastra background task. */
  hasDeferredCalls: boolean;
}

const pidKey = (pid: string) => `pid:${pid}`;

/** Live a notice is a `data-signal` part; read back from memory it is its own signal message. */
function messageSignals(message: MastraDBMessage): SignalData[] {
  if (message.role === 'signal') {
    if (isUserSignalType(getSignalType(message))) return [];
    const signal = toReactiveSignalData(message);
    return isSignalData(signal) ? [signal] : [];
  }
  return message.content.parts.flatMap(part =>
    part.type === 'data-signal' && 'data' in part && isSignalData(part.data) ? [part.data] : [],
  );
}

function workspaceIdFor(parts: MessageFactoryPart[], toolCallId: string): string | undefined {
  for (const part of parts) {
    if (part.type !== 'data-workspace-metadata' || !('data' in part) || !isRecord(part.data)) continue;
    if (part.data.toolCallId === toolCallId && typeof part.data.id === 'string') return part.data.id;
  }
  return undefined;
}

/** The thread's background commands, the exits their notices report, and whether a deferred call is still on. */
export function threadBackgroundWork(messages: readonly MastraDBMessage[]): ThreadBackgroundWork {
  const work: ThreadBackgroundWork = { commands: [], exits: new Map(), hasDeferredCalls: false };
  for (const message of messages) {
    for (const signal of messageSignals(message)) {
      const exit = processExitNotice(signal);
      if (exit) work.exits.set(exit.toolCallId ?? pidKey(exit.pid), exit);
    }
    if (message.role !== 'assistant') continue;
    const parts: MessageFactoryPart[] = message.content.parts;
    for (const part of parts) {
      if (!isToolPart(part)) continue;
      const call = readToolPart(part);
      if (isDeferredCall(call.backgroundTaskId, call.backgroundTaskStatus)) work.hasDeferredCalls = true;
      const pid = backgroundProcessPid(call.toolName, call.output);
      if (pid && call.toolCallId) {
        work.commands.push({ toolCallId: call.toolCallId, pid, workspaceId: workspaceIdFor(parts, call.toolCallId) });
      }
    }
  }
  return work;
}

export function exitFor(
  exits: ThreadBackgroundWork['exits'],
  command: Pick<BackgroundCommand, 'toolCallId' | 'pid'>,
): ProcessExitNotice | undefined {
  return exits.get(command.toolCallId) ?? exits.get(pidKey(command.pid));
}
