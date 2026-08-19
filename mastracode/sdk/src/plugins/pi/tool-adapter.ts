import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';

import { writeToolProgress } from '../../plugin.js';
import type { MastraCodePluginTools, MastraCodeToolRenderConfig } from '../../plugin.js';
import { runPiToolCallHooks, runPiToolResultHooks } from './hook-adapter.js';
import { adaptPiToolRenderers } from './render-adapter.js';
import { adaptPiTypeBoxSchema, validatePiToolArguments } from './schema-adapter.js';
import type { PiExtensionGeneration } from './types.js';

export interface PiToolContentBlock {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface PiToolResult {
  content: PiToolContentBlock[];
  details?: unknown;
  isError?: boolean;
  usage?: unknown;
  addedToolNames?: string[];
  terminate?: boolean;
  [key: string]: unknown;
}

export interface AdaptedPiToolResult {
  content: PiToolContentBlock[];
  details?: unknown;
  usage?: unknown;
  addedToolNames?: string[];
  terminate?: boolean;
  isError: false;
}

export class PiToolExecutionError extends Error {
  readonly result: PiToolResult;

  constructor(toolName: string, result: PiToolResult) {
    const text = result.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .filter((value): value is string => typeof value === 'string')
      .join('\n');
    super(text || `Pi tool "${toolName}" failed`);
    this.name = 'PiToolExecutionError';
    this.result = result;
  }
}

export interface AdaptPiToolsOptions {
  cwd: string;
  mode?: 'tui' | 'rpc' | 'json' | 'print';
  replaceArguments?: (toolName: string, args: unknown) => unknown | Promise<unknown>;
}

export interface AdaptedPiTools {
  tools: MastraCodePluginTools;
  renderConfigs: Record<string, MastraCodeToolRenderConfig>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeContent(content: unknown, toolName: string): PiToolContentBlock[] {
  if (!Array.isArray(content)) throw new Error(`Pi tool "${toolName}" returned invalid content`);
  return content.map((block, index) => {
    if (!isRecord(block)) throw new Error(`Pi tool "${toolName}" returned invalid content block ${index}`);
    if (block.type === 'text' && typeof block.text === 'string') {
      return { type: 'text', text: block.text };
    }
    if (block.type === 'image' && typeof block.data === 'string' && typeof block.mimeType === 'string') {
      return { type: 'image', data: block.data, mimeType: block.mimeType };
    }
    throw new Error(`Pi tool "${toolName}" returned unsupported content block ${index}`);
  });
}

function normalizeJsonValue(value: unknown, field: string, toolName: string): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new Error(
      `Pi tool "${toolName}" returned non-serializable ${field}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function normalizeResult(value: unknown, toolName: string): PiToolResult {
  if (!isRecord(value)) throw new Error(`Pi tool "${toolName}" returned an invalid result`);
  if (
    value.addedToolNames !== undefined &&
    (!Array.isArray(value.addedToolNames) || value.addedToolNames.some(name => typeof name !== 'string'))
  ) {
    throw new Error(`Pi tool "${toolName}" returned invalid addedToolNames`);
  }
  if (value.terminate !== undefined && typeof value.terminate !== 'boolean') {
    throw new Error(`Pi tool "${toolName}" returned invalid terminate flag`);
  }
  return {
    content: normalizeContent(value.content, toolName),
    ...(value.details !== undefined ? { details: normalizeJsonValue(value.details, 'details', toolName) } : {}),
    ...(value.usage !== undefined ? { usage: normalizeJsonValue(value.usage, 'usage', toolName) } : {}),
    ...(value.addedToolNames !== undefined ? { addedToolNames: value.addedToolNames } : {}),
    ...(value.terminate !== undefined ? { terminate: value.terminate } : {}),
    ...(value.isError === true ? { isError: true } : {}),
  };
}

function progressDetail(value: PiToolResult): string {
  const text = value.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .filter((entry): entry is string => typeof entry === 'string')
    .join('\n');
  return text || 'Pi tool progress';
}

export function adaptPiTools(generation: PiExtensionGeneration, options: AdaptPiToolsOptions): AdaptedPiTools {
  const tools: MastraCodePluginTools = {};
  const renderConfigs: Record<string, MastraCodeToolRenderConfig> = {};

  for (const [name, definition] of generation.registrations.tools) {
    if (typeof definition.execute !== 'function') {
      throw new Error(`Pi tool "${name}" must define execute`);
    }
    const inputSchema = adaptPiTypeBoxSchema(definition.parameters, name);

    if (definition.prepareArguments) generation.recordCapability('tool:prepareArguments');
    if (definition.constrainedSampling) generation.recordCapability('tool:constrainedSampling');
    if (definition.executionMode) {
      generation.recordCapability('tool:executionMode');
      if (definition.executionMode === 'sequential') {
        generation.addDiagnostic(
          'warning',
          `Pi extension "${generation.extensionId}" tool "${name}" requests sequential execution, which Mastra Code cannot enforce globally.`,
          'tool:executionMode',
        );
      }
    }

    const tool = createTool({
      id: name,
      description: definition.description ?? definition.label ?? name,
      inputSchema,
      execute: async (input, context) => {
        generation.assertActive();
        const toolCallId = context.agent?.toolCallId ?? `${generation.id}:${name}`;
        const extensionContext = {
          cwd: options.cwd,
          mode: options.mode ?? 'print',
          hasUI: false,
        } as const;
        const event = {
          type: 'tool_call' as const,
          toolCallId,
          toolName: name,
          input: isRecord(input) ? structuredClone(input) : {},
        };
        const hookResult = await runPiToolCallHooks(generation, event, extensionContext);
        if (hookResult.blocked) {
          throw new Error(hookResult.reason ?? `Pi tool "${name}" was blocked`);
        }
        const replacement = options.replaceArguments
          ? await options.replaceArguments(name, hookResult.input)
          : hookResult.input;
        const args = await validatePiToolArguments(inputSchema, replacement, name, 'replacement arguments');
        let settled = false;
        const progressWrites: Promise<void>[] = [];
        const onUpdate = (update: unknown) => {
          if (settled) return;
          const normalized = normalizeResult(update, name);
          progressWrites.push(
            writeToolProgress(context as ToolExecutionContext, {
              status: normalized.isError ? 'error' : 'running',
              detail: progressDetail(normalized),
            }),
          );
        };
        let value: unknown;
        try {
          value = await definition.execute!(toolCallId, args, context.abortSignal, onUpdate, extensionContext);
        } finally {
          settled = true;
          await Promise.all(progressWrites);
        }
        let result = normalizeResult(value, name);
        const hookedResult = await runPiToolResultHooks(
          generation,
          {
            type: 'tool_result',
            toolCallId,
            toolName: name,
            input: isRecord(args) ? args : {},
            content: result.content,
            details: result.details,
            isError: result.isError === true,
            usage: result.usage,
          },
          extensionContext,
        );
        const terminate = result.terminate === true || hookResult.terminate;
        result = normalizeResult({ ...result, ...hookedResult, ...(terminate ? { terminate: true } : {}) }, name);
        if (result.addedToolNames?.length) generation.recordCapability('tool:addedToolNames');
        if (result.terminate) generation.recordCapability('tool:terminate');
        if (result.isError) throw new PiToolExecutionError(name, result);
        return { ...result, isError: false } satisfies AdaptedPiToolResult;
      },
    });

    tools[name] = tool;
    const renderConfig = adaptPiToolRenderers(generation, definition, options.cwd);
    if (renderConfig) renderConfigs[name] = renderConfig;
  }

  return { tools, renderConfigs };
}
