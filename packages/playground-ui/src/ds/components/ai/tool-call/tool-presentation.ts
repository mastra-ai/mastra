import type { LucideIcon } from 'lucide-react';

import type { ToolKind } from './tool-phrases';
import { agentGlyph } from '@/ds/components/AgentIndicator';
import type { AgentIndicatorState } from '@/ds/components/AgentIndicator';
import { humanize } from '@/lib/string';

export interface ToolPresentation {
  /** What the agent indicator turns into while this call runs. */
  pose: AgentIndicatorState;
  /** The pose held still, so the call's row and the live indicator draw the same thing. */
  icon: LucideIcon;
  /** Stable name of the kind of tool, e.g. "Run"; also groups calls by kind. */
  label: string;
  /** Salient argument shown next to the label: command, path, pattern… */
  detail?: string;
  /**
   * What a command does, in the agent's words. `ActivityHeadline` shows it alone in place of
   * label and detail; both stay set for consumers that render them directly.
   */
  description?: string;
  /** Shell command, when the tool is terminal-style. Drives the expanded body. */
  command?: string;
}

/** Tool arguments and results as the mono body shows them: strings verbatim, the rest pretty JSON. */
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

interface ToolStyle {
  pose: AgentIndicatorState;
  label: ToolKind;
  detailKeys?: string[];
  isCommand?: boolean;
}

const TOOL_STYLES: Record<string, ToolStyle> = {
  view: { pose: 'reading', label: 'Read', detailKeys: ['path'] },
  read_file: { pose: 'reading', label: 'Read', detailKeys: ['path'] },
  write_file: { pose: 'editing', label: 'Write', detailKeys: ['path'] },
  create_file: { pose: 'editing', label: 'Write', detailKeys: ['path'] },
  edit_file: { pose: 'editing', label: 'Edit', detailKeys: ['path'] },
  string_replace: { pose: 'editing', label: 'Edit', detailKeys: ['path'] },
  str_replace: { pose: 'editing', label: 'Edit', detailKeys: ['path'] },
  ast_edit: { pose: 'editing', label: 'Edit', detailKeys: ['path'] },
  execute_command: { pose: 'running', label: 'Run', detailKeys: ['command'], isCommand: true },
  get_process_output: { pose: 'reading', label: 'Process output', detailKeys: ['pid'] },
  kill_process: { pose: 'running', label: 'Stop process', detailKeys: ['pid'] },
  find_files: { pose: 'finding', label: 'Find files', detailKeys: ['pattern', 'path'] },
  list_files: { pose: 'finding', label: 'List files', detailKeys: ['pattern', 'path'] },
  grep: { pose: 'searching', label: 'Search', detailKeys: ['pattern', 'path'] },
  search_content: { pose: 'searching', label: 'Search', detailKeys: ['pattern', 'query'] },
  search: { pose: 'searching', label: 'Search', detailKeys: ['query'] },
  web_search: { pose: 'browsing', label: 'Search the web', detailKeys: ['query'] },
  lsp_inspect: { pose: 'reading', label: 'Inspect code', detailKeys: ['path'] },
  file_stat: { pose: 'reading', label: 'File info', detailKeys: ['path'] },
  delete: { pose: 'deleting', label: 'Delete', detailKeys: ['path'] },
  delete_file: { pose: 'deleting', label: 'Delete', detailKeys: ['path'] },
  mkdir: { pose: 'editing', label: 'New folder', detailKeys: ['path'] },
  skill: { pose: 'skill', label: 'Skill', detailKeys: ['name'] },
  skill_search: { pose: 'skill', label: 'Search skills', detailKeys: ['query'] },
  skill_read: { pose: 'skill', label: 'Skill file', detailKeys: ['path'] },
  knowledge_search: { pose: 'searching', label: 'Search knowledge', detailKeys: ['query'] },
  knowledge_read: { pose: 'reading', label: 'Read page', detailKeys: ['page', 'scope'] },
  knowledge_page: { pose: 'editing', label: 'Write page', detailKeys: ['name', 'page'] },
  knowledge_note: { pose: 'editing', label: 'Note', detailKeys: ['page'] },
  knowledge_pin: { pose: 'memory', label: 'Pin', detailKeys: ['page'] },
};

/** Agents prefix commands with `cd <workspace> &&`, which crowds out the command itself on a one-line row. */
function withoutCdPrefix(command: string): string {
  return command.replace(/^\s*cd\s+(?:'[^']*'|"[^"]*"|[^\s&|;]+)\s*&&\s*/, '') || command;
}

export function presentTool(toolName: string, args: unknown): ToolPresentation {
  const style = TOOL_STYLES[toolName.replace(/^mastra_workspace_/, '')];
  if (!style) return { pose: 'tool', icon: agentGlyph('tool'), label: humanize(toolName) };

  const dressed = { pose: style.pose, icon: agentGlyph(style.pose), label: style.label };
  const detail = style.detailKeys ? firstStringArg(args, style.detailKeys) : undefined;
  if (!detail) return dressed;
  if (!style.isCommand) return { ...dressed, detail };
  // Workspaces with `requireDescription` have the agent say what a command does; that reads better
  // on a one-line row than "Run" and the command, which stays in the expanded body.
  const description = stringArg(args, 'description')?.replace(/\s+/g, ' ').trim() || undefined;
  return { ...dressed, detail: withoutCdPrefix(detail), description, command: detail };
}

export type ToolEdit = { path?: string } & ({ oldText: string; newText: string } | { content: string });

function stringField(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object' || !hasProperty(args, key)) return undefined;
  return typeof args[key] === 'string' ? args[key] : undefined;
}

export function toolEdit(toolName: string, args: unknown): ToolEdit | undefined {
  const path = stringField(args, 'path');
  const newText = stringField(args, 'new_string');
  if (/string_replace|str_replace|edit_file/i.test(toolName) && newText !== undefined) {
    return { path, oldText: stringField(args, 'old_string') ?? '', newText };
  }
  const content = stringField(args, 'content');
  if (/write_file|create_file/i.test(toolName) && content !== undefined) return { path, content };
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

/** Task tools draw in the docked task list, never as a transcript row. */
const TASK_TOOLS = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

export function isTaskTool(toolName: string): boolean {
  return TASK_TOOLS.has(toolName);
}
