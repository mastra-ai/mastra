import { isWebSearchToolName, webSearchAction, webSearchTarget } from '@mastra/core/tools/provider-web-search';
import {
  BookOpen,
  Braces,
  CircleStop,
  Eye,
  FileSearch,
  FolderPlus,
  FolderSearch,
  Globe,
  ScrollText,
  Search,
  SquarePen,
  SquareTerminal,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ToolCall } from '../../services/transcript';

type ToolCallPresentation = Pick<ToolCall, 'toolName' | 'args' | 'result'>;

export interface ToolPresentation {
  icon: LucideIcon;
  label: string;
  /** Salient argument shown next to the label: command, path, pattern… */
  detail?: string;
  /** Shell command, when the tool is terminal-style. Drives the expanded body. */
  command?: string;
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
  icon: LucideIcon;
  label: string;
  detailKeys?: string[];
  isCommand?: boolean;
}

const TOOL_STYLES: Record<string, ToolStyle> = {
  view: { icon: Eye, label: 'Read', detailKeys: ['path'] },
  read_file: { icon: Eye, label: 'Read', detailKeys: ['path'] },
  write_file: { icon: SquarePen, label: 'Write', detailKeys: ['path'] },
  create_file: { icon: SquarePen, label: 'Write', detailKeys: ['path'] },
  edit_file: { icon: SquarePen, label: 'Edit', detailKeys: ['path'] },
  string_replace: { icon: SquarePen, label: 'Edit', detailKeys: ['path'] },
  str_replace: { icon: SquarePen, label: 'Edit', detailKeys: ['path'] },
  ast_edit: { icon: SquarePen, label: 'Edit', detailKeys: ['path'] },
  execute_command: { icon: SquareTerminal, label: 'Run', detailKeys: ['command'], isCommand: true },
  get_process_output: { icon: ScrollText, label: 'Process output', detailKeys: ['pid'] },
  kill_process: { icon: CircleStop, label: 'Stop process', detailKeys: ['pid'] },
  find_files: { icon: FolderSearch, label: 'Find files', detailKeys: ['pattern', 'path'] },
  list_files: { icon: FolderSearch, label: 'List files', detailKeys: ['pattern', 'path'] },
  grep: { icon: Search, label: 'Search', detailKeys: ['pattern', 'path'] },
  search_content: { icon: Search, label: 'Search', detailKeys: ['pattern', 'query'] },
  search: { icon: Search, label: 'Search', detailKeys: ['query'] },
  lsp_inspect: { icon: Braces, label: 'Inspect code', detailKeys: ['path'] },
  file_stat: { icon: FileSearch, label: 'File info', detailKeys: ['path'] },
  delete: { icon: Trash2, label: 'Delete', detailKeys: ['path'] },
  delete_file: { icon: Trash2, label: 'Delete', detailKeys: ['path'] },
  mkdir: { icon: FolderPlus, label: 'New folder', detailKeys: ['path'] },
  skill: { icon: BookOpen, label: 'Skill', detailKeys: ['name'] },
  skill_search: { icon: BookOpen, label: 'Search skills', detailKeys: ['query'] },
  skill_read: { icon: BookOpen, label: 'Skill file', detailKeys: ['path'] },
};

function prettifyToolName(toolName: string): string {
  const words = toolName.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : toolName;
}

/** Agents prefix commands with `cd <workspace> &&`, which crowds out the command itself on a one-line row. */
function withoutCdPrefix(command: string): string {
  return command.replace(/^\s*cd\s+(?:'[^']*'|"[^"]*"|[^\s&|;]+)\s*&&\s*/, '') || command;
}

const WEB_SEARCH_LABELS: Record<string, string> = {
  search: 'Search the web',
  openPage: 'Open page',
  findInPage: 'Find in page',
};

/** Provider-run search has no input to read: the call it made comes back in the result. */
function presentWebSearch(args: unknown, result: unknown): ToolPresentation {
  const query = stringArg(args, 'query');
  if (query) return { icon: Globe, label: 'Search the web', detail: query };

  const action = webSearchAction(result);
  if (!action) return { icon: Globe, label: 'Search the web' };
  return {
    icon: Globe,
    label: WEB_SEARCH_LABELS[action.type] ?? 'Search the web',
    detail: webSearchTarget(action),
  };
}

export function presentTool({ toolName, args, result }: ToolCallPresentation): ToolPresentation {
  const name = toolName.replace(/^mastra_workspace_/, '');
  if (isWebSearchToolName(name)) return presentWebSearch(args, result);

  const style = TOOL_STYLES[name];
  if (!style) return { icon: Wrench, label: prettifyToolName(toolName) };

  const detail = style.detailKeys ? firstStringArg(args, style.detailKeys) : undefined;
  if (!detail) return { icon: style.icon, label: style.label };
  if (!style.isCommand) return { icon: style.icon, label: style.label, detail };
  return { icon: style.icon, label: style.label, detail: withoutCdPrefix(detail), command: detail };
}
