import { formatSignalValue, signalContentsToText } from '../messages/signal-data';
import type { SignalData } from '../messages/signal-data';

/** What core's exit notice for a background process says: `notification` signal, `background-process` tag. */
export interface ProcessExitNotice {
  pid: string;
  exitCode: number;
  toolCallId?: string;
  command?: string;
}

/** What core's notice for a finished background task says: `notification` signal, `background-task` tag. */
export interface TaskNotice {
  taskId: string;
  status: string;
  toolCallId?: string;
  toolName?: string;
}

// The command is only in the text: "Background process <pid> exited with code <n>: <command>".
const EXIT_LINE = /^Background process .+? exited with code -?\d+: (.+)$/m;

const readExitCode = (value: unknown): number | undefined => {
  const exitCode = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof exitCode === 'number' && Number.isInteger(exitCode) ? exitCode : undefined;
};

export function processExitNotice(signal: SignalData): ProcessExitNotice | undefined {
  if (signal.type !== 'notification' || signal.tagName !== 'background-process') return undefined;
  const pid = formatSignalValue(signal.attributes?.pid);
  const exitCode = readExitCode(signal.attributes?.exitCode);
  if (!pid || exitCode === undefined) return undefined;
  return {
    pid,
    exitCode,
    toolCallId: formatSignalValue(signal.attributes?.toolCallId),
    command: EXIT_LINE.exec(signalContentsToText(signal.contents))?.[1],
  };
}

export const isBackgroundNotice = (signal: SignalData): boolean =>
  processExitNotice(signal) !== undefined || taskNotice(signal) !== undefined;

export function taskNotice(signal: SignalData): TaskNotice | undefined {
  if (signal.type !== 'notification' || signal.tagName !== 'background-task') return undefined;
  const taskId = formatSignalValue(signal.attributes?.taskId);
  const status = formatSignalValue(signal.attributes?.status);
  if (!taskId || !status) return undefined;
  return {
    taskId,
    status,
    toolCallId: formatSignalValue(signal.attributes?.toolCallId),
    toolName: formatSignalValue(signal.attributes?.toolName),
  };
}
