import type { ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import type { MessageList } from '../../agent/message-list';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';
import type { PromptRole, PromptSummary, ToolSurfaceSummary, ToolSummary } from './types';

const emptyRoleCounts = (): Record<PromptRole, number> => ({
  system: 0,
  user: 0,
  assistant: 0,
  tool: 0,
  other: 0,
});

function roleFromValue(value: unknown): PromptRole {
  return value === 'system' || value === 'user' || value === 'assistant' || value === 'tool' ? value : 'other';
}

function countStringChars(value: unknown, seen = new WeakSet<object>(), depth = 0): number {
  if (depth > 20) {
    return 0;
  }

  if (typeof value === 'string') {
    return value.length;
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  if (seen.has(value)) {
    return 0;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countStringChars(item, seen, depth + 1), 0);
  }

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, item) => total + countStringChars(item, seen, depth + 1),
    0,
  );
}

function countContentParts(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === 'object' && Array.isArray((value as { parts?: unknown }).parts)) {
    return (value as { parts: unknown[] }).parts.length;
  }

  return value == null ? 0 : 1;
}

function getMessages(input: unknown): unknown[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  const maybeMessageList = input as Partial<MessageList>;
  if (typeof maybeMessageList.get?.all?.db === 'function') {
    const systemMessages =
      typeof maybeMessageList.getAllSystemMessages === 'function' ? maybeMessageList.getAllSystemMessages() : [];
    return [...systemMessages, ...maybeMessageList.get.all.db()];
  }

  if (typeof input === 'object') {
    const nestedMessageList = (input as { messageList?: unknown }).messageList as Partial<MessageList> | undefined;
    if (typeof nestedMessageList?.get?.all?.db === 'function') {
      const systemMessages =
        typeof nestedMessageList.getAllSystemMessages === 'function' ? nestedMessageList.getAllSystemMessages() : [];
      return [...systemMessages, ...nestedMessageList.get.all.db()];
    }
  }

  if (typeof input === 'object' && Array.isArray((input as { messages?: unknown }).messages)) {
    const systemMessages = Array.isArray((input as { systemMessages?: unknown }).systemMessages)
      ? (input as { systemMessages: unknown[] }).systemMessages
      : [];
    return [...systemMessages, ...(input as { messages: unknown[] }).messages];
  }

  if (typeof input === 'object' && Array.isArray((input as { modelContextMessages?: unknown }).modelContextMessages)) {
    const systemMessages = Array.isArray((input as { systemMessages?: unknown }).systemMessages)
      ? (input as { systemMessages: unknown[] }).systemMessages
      : [];
    return [...systemMessages, ...(input as { modelContextMessages: unknown[] }).modelContextMessages];
  }

  return [];
}

export function summarizePrompt(input: unknown): PromptSummary {
  const charsByRole = emptyRoleCounts();
  const partsByRole = emptyRoleCounts();
  const messages = getMessages(input);

  for (const message of messages) {
    const role = roleFromValue((message as { role?: unknown })?.role);
    const content = (message as { content?: unknown })?.content ?? message;
    charsByRole[role] += countStringChars(content);
    partsByRole[role] += countContentParts(content);
  }

  return {
    messageCount: messages.length,
    totalChars: Object.values(charsByRole).reduce((total, value) => total + value, 0),
    charsByRole,
    partsByRole,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function schemaCharCount(value: unknown, io: 'input' | 'output'): number {
  if (value === undefined) {
    return 0;
  }

  try {
    if (isPlainObject(value) && 'jsonSchema' in value) {
      return JSON.stringify(value.jsonSchema)?.length ?? 0;
    }

    if (isStandardSchemaWithJSON(value)) {
      return JSON.stringify(standardSchemaToJSONSchema(value, { io }))?.length ?? 0;
    }

    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function summarizeToolEntry(registryKey: string, tool: unknown): ToolSummary {
  if (!isPlainObject(tool)) {
    return {
      id: registryKey,
      name: registryKey,
      inputSchemaChars: 0,
      outputSchemaChars: 0,
    };
  }

  const id = safeString(tool.id) ?? registryKey;
  const name = safeString(tool.name) ?? id;
  const inputSchema = tool.parameters ?? tool.inputSchema ?? tool.inputJsonSchema;

  return {
    id,
    name,
    inputSchemaChars: schemaCharCount(inputSchema, 'input'),
    outputSchemaChars: schemaCharCount(tool.outputSchema, 'output'),
  };
}

function summarizeToolChoice(toolChoice: unknown): ToolSurfaceSummary['toolChoice'] {
  if (typeof toolChoice === 'string') {
    return toolChoice;
  }

  if (!isPlainObject(toolChoice)) {
    return undefined;
  }

  const type = safeString(toolChoice.type);
  if (!type) {
    return undefined;
  }

  return {
    type,
    ...(safeString(toolChoice.toolName) ? { toolName: safeString(toolChoice.toolName) } : {}),
  };
}

export function summarizeToolSurface({
  tools,
  toolChoice,
  activeTools,
}: {
  tools?: ToolSet | Record<string, unknown>;
  toolChoice?: ToolChoice<ToolSet> | unknown;
  activeTools?: string[] | readonly string[] | unknown;
}): ToolSurfaceSummary {
  const toolEntries = isPlainObject(tools) ? Object.entries(tools) : [];
  const activeToolNames = Array.isArray(activeTools)
    ? activeTools.filter((tool): tool is string => typeof tool === 'string')
    : undefined;

  return {
    toolCount: toolEntries.length,
    toolChoice: summarizeToolChoice(toolChoice),
    ...(activeToolNames ? { activeTools: activeToolNames } : {}),
    tools: toolEntries.map(([key, value]) => summarizeToolEntry(key, value)),
  };
}

export function summarizePromptAndTools(args: {
  prompt?: unknown;
  tools?: ToolSet | Record<string, unknown>;
  toolChoice?: ToolChoice<ToolSet> | unknown;
  activeTools?: string[] | readonly string[] | unknown;
}) {
  return {
    prompt: summarizePrompt(args.prompt),
    toolSurface: summarizeToolSurface({
      tools: args.tools,
      toolChoice: args.toolChoice,
      activeTools: args.activeTools,
    }),
  };
}
