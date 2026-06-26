import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { TaskItem } from '@mastra/core/harness';
import type { ChunkType, DataChunkType } from '@mastra/core/stream';

export const TASK_TOOL_NAMES = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);
const TASK_SIGNAL_ID = 'tasks';
const TASK_TAG_NAMES = new Set(['current-task-list', 'task-list-update']);
const TASK_STATUSES = new Set(['pending', 'in_progress', 'completed']);

type DataChunk = Extract<ChunkType, DataChunkType>;

const isDataChunk = (chunk: ChunkType): chunk is DataChunk =>
  typeof chunk.type === 'string' && chunk.type.startsWith('data-');

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTaskStatus = (value: unknown): value is TaskItem['status'] =>
  typeof value === 'string' && TASK_STATUSES.has(value);

export const isTaskItemArray = (value: unknown): value is TaskItem[] =>
  Array.isArray(value) &&
  value.every(
    item =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.content === 'string' &&
      isTaskStatus(item.status) &&
      typeof item.activeForm === 'string',
  );

const isTaskSignal = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return value.id === TASK_SIGNAL_ID || (typeof value.tagName === 'string' && TASK_TAG_NAMES.has(value.tagName));
};

const extractTasksFromSignalData = (data: unknown): TaskItem[] | undefined => {
  if (!isTaskSignal(data) || !isRecord(data)) return undefined;
  const metadata = data.metadata;
  if (!isRecord(metadata)) return undefined;
  const value = metadata.value;
  if (!isRecord(value)) return undefined;
  return isTaskItemArray(value.tasks) ? value.tasks : undefined;
};

const parseTasksFromResult = (raw: unknown): TaskItem[] | undefined => {
  if (isRecord(raw) && isTaskItemArray(raw.tasks)) return raw.tasks;

  if (typeof raw !== 'string') return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && isTaskItemArray(parsed.tasks) ? parsed.tasks : undefined;
  } catch {
    return undefined;
  }
};

export const extractTasksFromSignalChunk = (chunk: ChunkType): TaskItem[] | undefined => {
  if (!isDataChunk(chunk)) return undefined;
  return extractTasksFromSignalData(chunk.data);
};

export const extractTasksFromToolResultChunk = (chunk: ChunkType): TaskItem[] | undefined => {
  if (chunk.type !== 'tool-result') return undefined;
  const payload = chunk.payload;
  if (!isRecord(payload) || typeof payload.toolName !== 'string' || !TASK_TOOL_NAMES.has(payload.toolName)) {
    return undefined;
  }
  return parseTasksFromResult(payload.result);
};

const extractTasksFromToolInvocationPart = (part: unknown): TaskItem[] | undefined => {
  if (!isRecord(part) || part.type !== 'tool-invocation' || !isRecord(part.toolInvocation)) return undefined;
  const toolInvocation = part.toolInvocation;
  if (typeof toolInvocation.toolName !== 'string' || !TASK_TOOL_NAMES.has(toolInvocation.toolName)) return undefined;
  return parseTasksFromResult(toolInvocation.result);
};

const extractTasksFromDataPart = (part: unknown): TaskItem[] | undefined => {
  if (!isRecord(part) || typeof part.type !== 'string' || !part.type.startsWith('data-')) return undefined;
  return extractTasksFromSignalData(part.data);
};

const extractTasksFromSignalMessage = (message: MastraDBMessage): TaskItem[] | undefined => {
  if (message.role !== 'signal') return undefined;
  const metadata = message.content?.metadata;
  if (!isRecord(metadata)) return undefined;
  return extractTasksFromSignalData(metadata.signal);
};

export const extractLatestTasksFromMessages = (messages: MastraDBMessage[]): TaskItem[] => {
  let latest: TaskItem[] | undefined;

  for (const message of messages) {
    for (const part of message.content?.parts ?? []) {
      const toolTasks = extractTasksFromToolInvocationPart(part);
      if (toolTasks !== undefined) latest = toolTasks;
    }

    const signalTasks = extractTasksFromSignalMessage(message);
    if (signalTasks !== undefined) latest = signalTasks;

    for (const part of message.content?.parts ?? []) {
      const dataTasks = extractTasksFromDataPart(part);
      if (dataTasks !== undefined) latest = dataTasks;
    }
  }

  return latest ?? [];
};
