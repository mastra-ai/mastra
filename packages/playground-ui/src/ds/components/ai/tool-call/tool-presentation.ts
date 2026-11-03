import type { LucideIcon } from 'lucide-react';

import { canonicalToolName, resolveToolStyle } from './tool-styles';
import { agentGlyph } from '@/ds/components/AgentIndicator';
import type { AgentIndicatorState } from '@/ds/components/AgentIndicator';
import { humanize } from '@/lib/string';

export interface ToolPresentation {
  pose: AgentIndicatorState;
  icon: LucideIcon;
  label: string;
  detail?: string;
  description?: string;
  command?: string;
}

export function stringifyToolValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function hasProperty<K extends string>(value: object, key: K): value is object & Record<K, unknown> {
  return key in value;
}

function stringArg(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object' || !hasProperty(args, key)) return undefined;
  const value = args[key];
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function firstStringArg(args: unknown, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringArg(args, key);
    if (value) return value;
  }
  return undefined;
}

function withoutCdPrefix(command: string): string {
  return command.replace(/^\s*cd\s+(?:'[^']*'|"[^"]*"|[^\s&|;]+)\s*&&\s*/, '') || command;
}

export function presentTool(toolName: string, args: unknown): ToolPresentation {
  const style = resolveToolStyle(toolName, stringArg(args, 'op') ?? stringArg(args, 'action'));
  if (!style) return { pose: 'tool', icon: agentGlyph('tool'), label: humanize(toolName) };

  const dressed = { pose: style.pose, icon: agentGlyph(style.pose), label: style.label };
  const detail = style.detailKeys ? firstStringArg(args, style.detailKeys) : undefined;
  if (!detail) return dressed;
  if (!style.isCommand) return { ...dressed, detail };
  const description = stringArg(args, 'description')?.replace(/\s+/g, ' ').trim() || undefined;
  return { ...dressed, detail: withoutCdPrefix(detail), description, command: detail };
}

export type ToolEdit = { path?: string } & ({ oldText: string; newText: string } | { content: string });

function stringField(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object' || !hasProperty(args, key)) return undefined;
  return typeof args[key] === 'string' ? args[key] : undefined;
}

export function toolEdit(toolName: string, args: unknown): ToolEdit | undefined {
  const name = canonicalToolName(toolName);
  const path = stringField(args, 'path') ?? stringField(args, 'file_path');
  const newText = stringField(args, 'new_string');
  if (/string_replace|str_replace|edit_file/i.test(name) && newText !== undefined) {
    return { path, oldText: stringField(args, 'old_string') ?? '', newText };
  }
  const content = stringField(args, 'content');
  if (/write_file|create_file/i.test(name) && content !== undefined) return { path, content };
  return undefined;
}

export interface ToolArgumentsInput {
  toolName: string;
  args?: unknown;
  argsText?: string;
  hideArguments?: boolean;
}

function isEmptyObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.keys(value).length === 0;
}

export function visibleToolArgumentsText({ args, argsText, hideArguments }: ToolArgumentsInput): string | undefined {
  if (hideArguments || isEmptyObject(args)) return undefined;
  return args === undefined ? argsText : stringifyToolValue(args);
}

export function hasToolArguments(input: ToolArgumentsInput): boolean {
  return Boolean(toolEdit(input.toolName, input.args) || visibleToolArgumentsText(input));
}

const TASK_TOOLS = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

export function isTaskTool(toolName: string): boolean {
  return TASK_TOOLS.has(toolName);
}
