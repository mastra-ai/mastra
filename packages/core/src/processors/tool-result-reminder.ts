import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize, posix, resolve, win32 } from 'node:path';
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
  /**
   * When provided and returning false for a request, no instruction-file
   * reminders are injected at all. Lets hosts suppress ingestion of
   * instruction files from untrusted checkouts (e.g. a PR branch under
   * review), where AGENTS.md content is attacker-controlled.
   */
  isEnabled?: (args: ProcessInputStepArgs) => boolean;
  /**
   * Per-request override for how instruction files are located and read.
   * When it returns a reader, that reader replaces the instance-level
   * pathExists/isDirectory/readFile for this request — e.g. serving content
   * from a trusted git ref instead of an untrusted working tree. Returning
   * undefined keeps the instance defaults.
   */
  getReader?: (args: ProcessInputStepArgs) => ReminderFileReader | undefined;
}

/** Filesystem-shaped read access used to locate and read instruction files. */
export interface ReminderFileReader {
  pathExists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  readFile: (path: string) => string;
  /**
   * Stable identity used only to deduplicate instruction paths. Read addresses
   * and emitted paths remain unchanged. Omit to use lexical absolute paths;
   * virtual readers must not resolve identities through the host filesystem.
   */
  getPathIdentity?: (path: string) => string;
}

function getPathIdentity(path: string, reader: ReminderFileReader): string {
  return reader.getPathIdentity?.(path) ?? toAbsolutePath(path);
}

function localPathIdentity(path: string): string {
  try {
    return toPosixPath(realpathSync(path));
  } catch {
    return toAbsolutePath(path);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInstructionFileName(name: string): boolean {
  return INSTRUCTION_FILE_NAMES.some(instructionFileName => instructionFileName.toLowerCase() === name.toLowerCase());
}

/**
 * Normalize path separators to forward slashes.
 *
 * Instruction paths are embedded in prompt reminders and used as the dedup
 * identity in metadata, so they must be stable across platforms. `node:path`
 * produces `\` separators on Windows; converting to `/` keeps the reminder
 * path (and the metadata used to avoid re-injection) identical on every OS.
 * Windows filesystem APIs accept forward slashes, so real reads still work.
 */
function toPosixPath(candidatePath: string): string {
  return candidatePath.replaceAll('\\', '/');
}

function usesWindowsPathSemantics(candidatePath: string): boolean {
  const normalizedPath = toPosixPath(candidatePath);
  return normalizedPath.startsWith('//') || (/^[a-zA-Z]:\//.test(normalizedPath) && win32.isAbsolute(normalizedPath));
}

function toAbsolutePath(candidatePath: string): string {
  if (usesWindowsPathSemantics(candidatePath)) {
    return toPosixPath(win32.normalize(candidatePath));
  }

  const absolutePath = normalize(isAbsolute(candidatePath) ? candidatePath : resolve(process.cwd(), candidatePath));
  return toPosixPath(absolutePath);
}

function dirnamePreservingWindowsRoot(candidatePath: string): string {
  return usesWindowsPathSemantics(candidatePath)
    ? toPosixPath(win32.dirname(candidatePath))
    : posix.dirname(candidatePath);
}

function joinPreservingWindowsRoot(basePath: string, childPath: string): string {
  return usesWindowsPathSemantics(basePath)
    ? toPosixPath(win32.join(basePath, childPath))
    : posix.join(basePath, childPath);
}

function findInstructionFileForPath(
  candidatePath: string,
  pathExists: (path: string) => boolean,
  isDirectory: (path: string) => boolean,
): string | undefined {
  const absoluteCandidatePath = toAbsolutePath(candidatePath);
  const candidateName = posix.basename(absoluteCandidatePath);

  if (isInstructionFileName(candidateName)) {
    return absoluteCandidatePath;
  }

  // Ordinary paths use POSIX operations so the walk is deterministic on every
  // platform. UNC and drive-rooted paths use win32 operations to preserve their
  // roots, then convert the result back to forward slashes.
  let currentDir = absoluteCandidatePath;
  if (!pathExists(currentDir) || !isDirectory(currentDir)) {
    currentDir = dirnamePreservingWindowsRoot(currentDir);
  }

  let previousDir: string | undefined;
  while (currentDir && currentDir !== previousDir) {
    for (const instructionFileName of INSTRUCTION_FILE_NAMES) {
      const instructionFilePath = joinPreservingWindowsRoot(currentDir, instructionFileName);
      if (pathExists(instructionFilePath)) {
        return instructionFilePath;
      }
    }

    previousDir = currentDir;
    currentDir = dirnamePreservingWindowsRoot(currentDir);
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
    type: 'reactive',
    tagName: 'system-reminder',
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

  for (const message of [...messages].reverse()) {
    const parts = isRecord(message.content) ? message.content.parts : undefined;
    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of [...parts].reverse()) {
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
  private readonly getPathIdentity?: (path: string) => string;
  private readonly getIgnoredInstructionPaths?: (args: ProcessInputStepArgs) => string[];
  private readonly isEnabled?: (args: ProcessInputStepArgs) => boolean;
  private readonly getReader?: (args: ProcessInputStepArgs) => ReminderFileReader | undefined;

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
    this.getPathIdentity =
      options.pathExists || options.isDirectory || options.readFile ? undefined : localPathIdentity;
    this.getIgnoredInstructionPaths = options.getIgnoredInstructionPaths;
    this.isEnabled = options.isEnabled;
    this.getReader = options.getReader;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList } = args;
    if (this.isEnabled && !this.isEnabled(args)) {
      return messageList;
    }
    const reader: ReminderFileReader = this.getReader?.(args) ?? {
      pathExists: this.pathExists,
      isDirectory: this.isDirectory,
      readFile: this.readFile,
      getPathIdentity: this.getPathIdentity,
    };
    const messages = messageList.get.all.db();
    // Memory processors can reclassify completed responses before this hook runs.
    const completedToolCalls = getCompletedToolCalls(messages);
    const checkedPaths = new Set<string>();
    for (const toolCall of completedToolCalls) {
      for (const instructionPath of this.findInstructionPathsInInvocation(toolCall, reader)) {
        const identity = getPathIdentity(instructionPath, reader);
        if (checkedPaths.has(identity)) {
          continue;
        }
        checkedPaths.add(identity);

        if (this.isIgnoredInstructionPath(args, identity, reader)) {
          continue;
        }

        const reminderText = this.getReminderText(instructionPath, reader);
        if (!reminderText) {
          continue;
        }

        const reminderMarkup = getReminderMarkup(reminderText, instructionPath);
        if (this.hasReminderAlready(messages, reminderMarkup, reader)) {
          continue;
        }

        await args.sendSignal?.({
          type: 'reactive',
          tagName: 'system-reminder',
          contents: reminderText,
          attributes: { type: REMINDER_TYPE, path: instructionPath },
          metadata: getReminderMetadata(instructionPath).systemReminder,
        });
        return messageList;
      }
    }

    return messageList;
  }

  private getReminderText(instructionPath: string, reader: ReminderFileReader): string | undefined {
    try {
      const content = reader.readFile(instructionPath).trim();
      if (content.length > 0) {
        return truncateToTokenLimit(content, this.maxTokens);
      }
    } catch {
      // Fall back to configured reminder text if file cannot be read.
    }

    return this.reminderText?.trim() || undefined;
  }

  private isIgnoredInstructionPath(args: ProcessInputStepArgs, identity: string, reader: ReminderFileReader): boolean {
    const ignoredPaths = this.getIgnoredInstructionPaths?.(args) ?? [];
    return ignoredPaths.some(path => getPathIdentity(path, reader) === identity);
  }

  private *findInstructionPathsInInvocation(invocation: unknown, reader: ReminderFileReader): Generator<string> {
    if (!isRecord(invocation)) {
      return;
    }

    const args = parseInvocationArgs(invocation.args);
    if (!args) {
      return;
    }

    for (const field of PATH_FIELDS) {
      const value = args[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        continue;
      }

      const instructionPath = findInstructionFileForPath(value, reader.pathExists, reader.isDirectory);
      if (instructionPath) {
        yield instructionPath;
      }
    }
  }

  private hasReminderAlready(messages: MastraDBMessage[], reminderMarkup: string, reader: ReminderFileReader): boolean {
    const reminderPath = extractReminderPath(reminderMarkup);
    const identity = reminderPath ? getPathIdentity(reminderPath, reader) : undefined;

    return messages.some(message => {
      if (message.role !== 'user' && message.role !== 'signal') {
        return false;
      }

      const metadataPath = extractReminderPathFromMetadata(message);
      if (metadataPath && getPathIdentity(metadataPath, reader) === identity) {
        return true;
      }

      const messageText = getMessageText(message);
      if (messageText.includes(reminderMarkup)) {
        return true;
      }

      if (!reminderPath) {
        return false;
      }

      const markupPath = extractReminderPath(messageText);
      return !!markupPath && getPathIdentity(markupPath, reader) === identity;
    });
  }
}
