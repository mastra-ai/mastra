import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { MessageFactoryPart } from '@mastra/react/ui';
import { isToolPart, readToolPart } from '../messages/renderers/tool-part';
import { getSignalType, isRecord, isSignalData, isUserSignalType, toReactiveSignalData } from '../messages/signal-data';
import type { SignalData } from '../messages/signal-data';
import { parseToolArgs } from '../tools/badges/workspace-data-parts';
import { isDeferredCall } from '../tools/tool-card-kind';
import { processExitNotice } from './background-notices';
import type { ProcessExitNotice } from './background-notices';
import { backgroundProcessPid } from './background-process';

/** A background `execute_command` call: the process it started and the workspace it ran in. */
export interface BackgroundCommand {
  toolCallId: string;
  pid: string;
  command?: string;
  /** From the call's `workspace-metadata` part; absent when the call wrote none. */
  workspaceId?: string;
}

export interface ThreadBackgroundWork {
  commands: BackgroundCommand[];
  /** Exit notices in thread order. */
  exits: ProcessExitNotice[];
  /** Whether a call in the thread still runs as a Mastra background task. */
  hasDeferredCalls: boolean;
}

export const EMPTY_BACKGROUND_WORK: ThreadBackgroundWork = { commands: [], exits: [], hasDeferredCalls: false };

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

const commandArg = (input: unknown): string | undefined => {
  const args = typeof input === 'string' || isRecord(input) ? parseToolArgs(input) : {};
  return typeof args.command === 'string' ? args.command : undefined;
};

/** The thread's background commands, the exit notices it got, and whether a deferred call is still on. */
export function threadBackgroundWork(messages: readonly MastraDBMessage[]): ThreadBackgroundWork {
  const work: ThreadBackgroundWork = { commands: [], exits: [], hasDeferredCalls: false };
  for (const message of messages) {
    for (const signal of messageSignals(message)) {
      const exit = processExitNotice(signal);
      if (exit) work.exits.push(exit);
    }
    if (message.role !== 'assistant') continue;
    const parts: MessageFactoryPart[] = message.content.parts;
    for (const part of parts) {
      if (!isToolPart(part)) continue;
      const call = readToolPart(part);
      if (isDeferredCall(call.backgroundTaskId, call.backgroundTaskStatus)) work.hasDeferredCalls = true;
      const pid = backgroundProcessPid(call.toolName, call.output);
      if (pid && call.toolCallId) {
        work.commands.push({
          toolCallId: call.toolCallId,
          pid,
          command: commandArg(call.input),
          workspaceId: workspaceIdFor(parts, call.toolCallId),
        });
      }
    }
  }
  return work;
}

/**
 * Whether a notice reports this command's exit. Providers reuse tool-call ids across turns and
 * sandboxes reuse PIDs, so both must match; a notice naming no call matches by PID only while
 * no other command in the thread has that PID.
 */
function reportsExitOf(work: ThreadBackgroundWork, exit: ProcessExitNotice, command: CommandRef): boolean {
  if (exit.pid !== command.pid) return false;
  if (exit.toolCallId) return exit.toolCallId === command.toolCallId;
  return work.commands.every(other => other.pid !== command.pid || other.toolCallId === command.toolCallId);
}

type CommandRef = Pick<BackgroundCommand, 'toolCallId' | 'pid'>;

export function exitFor(work: ThreadBackgroundWork, command: CommandRef): ProcessExitNotice | undefined {
  return work.exits.findLast(exit => reportsExitOf(work, exit, command));
}

/** The command an exit notice reports on, so its row can name the command the call ran. */
export function commandFor(work: ThreadBackgroundWork, exit: ProcessExitNotice): BackgroundCommand | undefined {
  return work.commands.findLast(command => reportsExitOf(work, exit, command));
}
