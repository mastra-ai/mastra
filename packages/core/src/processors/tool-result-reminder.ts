import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'node:path';
import { estimateTokenCount } from 'tokenx';
import type { MessageList, MastraDBMessage } from '../agent/message-list';
import { signalToXmlMarkup } from '../agent/signals';
import type { ProcessInputStepArgs, Processor, ToolCallInfo } from './index';

const INSTRUCTION_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md'] as const;
const PATH_FIELDS = ['path', 'file', 'filePath', 'target', 'targetPath', 'dest', 'destination'] as const;
const REMINDER_TYPE = 'dynamic-agents-md';
const LEGACY_REMINDER_METADATA_KEY = 'dynamicAgentsMdReminder';

type ReminderMetadataValue = {
  path?: string;
  type?: string;
};

type ReminderMessageMetadata = {
  systemReminder?: ReminderMetadataValue;
  dynamicAgentsMdReminder?: ReminderMetadataValue;
};

type TextPartLike = {
  type: 'text';
  text: string;
};

type ToolInvocationLike = {
  type: 'tool-invocation';
  toolInvocation?: {
    state?: string;
    toolCallId?: string;
    args?: unknown;
  };
};

export interface ToolResultReminderOptions {
  reminderText?: string;
  maxTokens?: number;
  pathExists?: (path: string) => boolean;
  isDirectory?: (path: string) => boolean;
  readFile?: (path: string) => string;
  getIgnoredInstructionPaths?: (args: ProcessInputStepArgs) => string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInstructionFileName(name: string): boolean {
  return INSTRUCTION_FILE_NAMES.some(instructionFileName => instructionFileName.toLowerCase() === name.toLowerCase());
}

function toAbsolutePath(candidatePath: string): string {
  return normalize(isAbsolute(candidatePath) ? candidatePath : resolve(process.cwd(), candidatePath));
}

function findInstructionFileForPath(
  candidatePath: string,
  pathExists: (path: string) => boolean,
  isDirectory: (path: string) => boolean,
): string | undefined {
  const absoluteCandidatePath = toAbsolutePath(candidatePath);
  const candidateName = basename(absoluteCandidatePath);

  if (isInstructionFileName(candidateName)) {
    return absoluteCandidatePath;
  }

  let currentDir = absoluteCandidatePath;
  if (!pathExists(currentDir) || !isDirectory(currentDir)) {
    currentDir = dirname(currentDir);
  }

  let previousDir: string | undefined;
  while (currentDir && currentDir !== previousDir) {
    for (const instructionFileName of INSTRUCTION_FILE_NAMES) {
      const instructionFilePath = join(currentDir, instructionFileName);
      if (pathExists(instructionFilePath)) {
        return instructionFilePath;
      }
    }

    previousDir = currentDir;
    currentDir = dirname(currentDir);
  }

  return undefined;
}

function getMessageText(message: MastraDBMessage): string {
  const parts = isRecord(message.content) ? message.content.parts : undefined;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .filter((part): part is TextPartLike => isRecord(part) && part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n');
}

function decodeXmlEntities(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
}

function extractReminderPath(messageText: string): string | undefined {
  const startTagIndex = messageText.indexOf('<system-reminder');
  if (startTagIndex === -1) {
    return undefined;
  }

  const startTagEndIndex = messageText.indexOf('>', startTagIndex);
  if (startTagEndIndex === -1) {
    return undefined;
  }

  const startTag = messageText.slice(startTagIndex, startTagEndIndex + 1);
  const pathMatch = startTag.match(/\bpath="([^"]+)"/);
  if (!pathMatch?.[1]) {
    return undefined;
  }

  return decodeXmlEntities(pathMatch[1]);
}

function getReminderMetadata(instructionPath: string): ReminderMessageMetadata {
  return {
    systemReminder: {
      path: instructionPath,
      type: REMINDER_TYPE,
    },
  };
}

function extractReminderPathFromMetadata(message: MastraDBMessage): string | undefined {
  const metadata = message.content.metadata;
  if (!isRecord(metadata)) {
    return undefined;
  }

  const reminderMetadata = isRecord(metadata.systemReminder)
    ? metadata.systemReminder
    : isRecord(metadata[LEGACY_REMINDER_METADATA_KEY])
      ? metadata[LEGACY_REMINDER_METADATA_KEY]
      : isRecord(metadata.signal) && isRecord(metadata.signal.attributes)
        ? metadata.signal.attributes
        : metadata;

  return typeof reminderMetadata.path === 'string' ? reminderMetadata.path : undefined;
}

function getReminderMarkup(reminderText: string, instructionPath: string): string {
  return signalToXmlMarkup({
    type: 'system-reminder',
    contents: reminderText,
    attributes: { type: REMINDER_TYPE, path: instructionPath },
  });
}

function truncateToTokenLimit(content: string, maxTokens: number): string {
  const estimatedTokens = estimateTokenCount(content);
  if (estimatedTokens <= maxTokens) {
    return content;
  }

  const approximateCharLimit = Math.max(maxTokens * 4, 1);
  const sliceEnd = Math.min(content.length, approximateCharLimit);
  const newlineIndex = content.lastIndexOf('\n', sliceEnd);
  const truncatedContent = content.slice(0, newlineIndex > 0 ? newlineIndex : sliceEnd).trimEnd();
  const shownTokens = estimateTokenCount(truncatedContent);

  return `${truncatedContent}\n\n[truncated — showing first ~${shownTokens} of ~${estimatedTokens} estimated tokens]`;
}

type CompletedToolCall = Pick<ToolCallInfo, 'toolCallId' | 'args'>;

function getCompletedToolCalls(messages: MastraDBMessage[]): CompletedToolCall[] {
  const completed: CompletedToolCall[] = [];

  for (const message of messages) {
    const parts = isRecord(message.content) ? message.content.parts : undefined;
    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (!isRecord(part) || part.type !== 'tool-invocation') {
        continue;
      }

      const invocation = (part as ToolInvocationLike).toolInvocation;
      if (!invocation || invocation.state !== 'result' || typeof invocation.toolCallId !== 'string') {
        continue;
      }

      completed.push({
        toolCallId: invocation.toolCallId,
        args: invocation.args,
      });
    }
  }

  return completed;
}

function getCurrentStepResponseMessages(messageList: MessageList): MastraDBMessage[] {
  return messageList.get.response.db();
}

function parseInvocationArgs(args: unknown): Record<string, unknown> | undefined {
  if (isRecord(args)) {
    return args;
  }

  if (typeof args !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(args);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Injects a persisted UI-visible reminder when the agent just interacted with
 * a path whose directory ancestry contains an instruction file such as AGENTS.md.
 */
export class AgentsMDInjector implements Processor<'agents-md-injector'> {
  id = 'agents-md-injector' as const;
  name = 'Agents.md Injector';
  description = 'Injects AGENTS.md reminders when instruction file operations are detected';
  processorIndex = 0;

  private readonly reminderText?: string;
  private readonly maxTokens: number;
  private readonly pathExists: (path: string) => boolean;
  private readonly isDirectory: (path: string) => boolean;
  private readonly readFile: (path: string) => string;
  private readonly getIgnoredInstructionPaths?: (args: ProcessInputStepArgs) => string[];

  constructor(options: ToolResultReminderOptions) {
    this.reminderText = options.reminderText;
    this.maxTokens = options.maxTokens ?? 1000;
    this.pathExists = options.pathExists ?? existsSync;
    this.isDirectory =
      options.isDirectory ??
      ((path: string) => {
        try {
          return statSync(path).isDirectory();
        } catch {
          return false;
        }
      });
    this.readFile = options.readFile ?? (path => readFileSync(path, 'utf-8'));
    this.getIgnoredInstructionPaths = options.getIgnoredInstructionPaths;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList } = args;
    const messages = messageList.get.all.db();
    const currentStepResponseMessages = getCurrentStepResponseMessages(messageList);
    const completedToolCalls = getCompletedToolCalls(currentStepResponseMessages);
    const instructionPath = this.findReferencedInstructionPath(completedToolCalls);

    if (!instructionPath || this.isIgnoredInstructionPath(args, instructionPath)) {
      return messageList;
    }

    const reminderText = this.getReminderText(instructionPath);
    if (!reminderText) {
      return messageList;
    }

    const reminderMarkup = getReminderMarkup(reminderText, instructionPath);
    if (this.hasReminderAlready(messages, reminderMarkup)) {
      return messageList;
    }

    await args.sendSignal?.({
      type: 'system-reminder',
      contents: reminderText,
      attributes: { type: REMINDER_TYPE, path: instructionPath },
      metadata: getReminderMetadata(instructionPath).systemReminder,
    });

    return messageList;
  }

  private getReminderText(instructionPath: string): string | undefined {
    try {
      const content = this.readFile(instructionPath).trim();
      if (content.length > 0) {
        return truncateToTokenLimit(content, this.maxTokens);
      }
    } catch {
      // Fall back to configured reminder text if file cannot be read.
    }

    return this.reminderText?.trim() || undefined;
  }

  private isIgnoredInstructionPath(args: ProcessInputStepArgs, instructionPath: string): boolean {
    const ignoredPaths = this.getIgnoredInstructionPaths?.(args) ?? [];
    const normalizedInstructionPath = toAbsolutePath(instructionPath);
    return ignoredPaths.some(path => toAbsolutePath(path) === normalizedInstructionPath);
  }

  private findReferencedInstructionPath(toolCalls?: CompletedToolCall[]): string | undefined {
    if (!Array.isArray(toolCalls)) {
      return undefined;
    }

    for (const toolCall of toolCalls) {
      const path = this.findInstructionPathInInvocation(toolCall);
      if (path) {
        return path;
      }
    }

    return undefined;
  }

  private findInstructionPathInInvocation(invocation: unknown): string | undefined {
    if (!isRecord(invocation)) {
      return undefined;
    }

    const args = parseInvocationArgs(invocation.args);
    if (!args) {
      return undefined;
    }

    for (const field of PATH_FIELDS) {
      const value = args[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        continue;
      }

      const instructionPath = findInstructionFileForPath(value, this.pathExists, this.isDirectory);
      if (instructionPath) {
        return instructionPath;
      }
    }

    return undefined;
  }

  private hasReminderAlready(messages: MastraDBMessage[], reminderMarkup: string): boolean {
    const reminderPath = extractReminderPath(reminderMarkup);

    return messages.some(message => {
      if (message.role !== 'user' && message.role !== 'signal') {
        return false;
      }

      if (reminderPath && extractReminderPathFromMetadata(message) === reminderPath) {
        return true;
      }

      const messageText = getMessageText(message);
      if (messageText.includes(reminderMarkup)) {
        return true;
      }

      if (!reminderPath) {
        return false;
      }

      return extractReminderPath(messageText) === reminderPath;
    });
  }
}
