import type { ActivityStatus } from '@mastra/playground-ui/components/ai/activity';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import type { ReasoningPart } from '@mastra/react/ui';
import { Brain } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ToolCall } from '../../services/transcript';
import { toolPhrases } from './tool-phrases';

export interface ToolView {
  kind: 'tool';
  key: string;
  tool: ToolCall;
}

export interface ReasoningView {
  kind: 'reasoning';
  key: string;
  part: ReasoningPart;
}

export type StretchView = ToolView | ReasoningView;

export interface StretchHeader {
  icon: LucideIcon;
  label: string;
  detail?: string;
  status: ActivityStatus;
  tools: number;
  failed: number;
  incomplete: number;
  startedAt?: number;
  /** How long a settled stretch of calls took, to the second: "1m 12s". A lone thought says it in its label. */
  duration?: string;
  /** Accessible name of the line: label, detail and duration as one phrase. */
  name: string;
}

const SUMMARY_KINDS = 3;

function header(
  icon: LucideIcon,
  label: string,
  detail: string | undefined,
  facts: Pick<StretchHeader, 'status' | 'tools' | 'failed' | 'incomplete' | 'startedAt' | 'duration'>,
): StretchHeader {
  const said = [label, detail].filter(Boolean).join(' ');
  const name = facts.duration ? `${said}, ${facts.duration}` : said;
  return { icon, label, detail, ...facts, name };
}

function secondsDuration(elapsedMs: number | undefined): string | undefined {
  if (elapsedMs === undefined || elapsedMs < 1_000) return undefined;
  return formatDuration(Math.round(elapsedMs / 1_000) * 1_000);
}

/** "Read files, ran a command": each kind once, in order of first use. */
function sentence(phrases: readonly string[]): string {
  const rest = phrases.length - SUMMARY_KINDS;
  const text = [...phrases.slice(0, SUMMARY_KINDS), ...(rest > 0 ? [`and ${rest} more`] : [])].join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function kindPhrases(tools: readonly ToolCall[]): string[] {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    const { label } = presentTool(tool.toolName, tool.args);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => {
    const phrases = toolPhrases(label);
    return count === 1 ? phrases.one : phrases.many;
  });
}

/** What a stretch's one line says: what it is doing now while live, a past-tense summary once settled. */
export function stretchHeader(members: readonly StretchView[], live: boolean, elapsedMs?: number): StretchHeader {
  const tools = members.flatMap(member => (member.kind === 'tool' ? [member.tool] : []));

  if (live) {
    const counts = {
      status: 'running' as const,
      tools: tools.length,
      failed: 0,
      incomplete: 0,
      startedAt: tools[0]?.createdAt,
    };
    const running = tools.findLast(tool => tool.status === 'running');
    if (!running) return header(Brain, 'Thinking', undefined, counts);
    const presentation = presentTool(running.toolName, running.args);
    if (presentation.description) return header(presentation.icon, presentation.description, undefined, counts);
    return header(presentation.icon, toolPhrases(presentation.label).live, presentation.detail, counts);
  }

  const failed = tools.filter(tool => tool.status === 'error').length;
  const incomplete = tools.filter(tool => tool.status === 'running').length;
  const counts = {
    status: failed > 0 ? ('error' as const) : ('idle' as const),
    tools: tools.length,
    failed,
    incomplete,
    startedAt: tools[0]?.createdAt,
  };
  const duration = secondsDuration(elapsedMs);
  const [first] = tools;
  if (!first) return header(Brain, duration ? `Thought for ${duration}` : 'Thought', undefined, counts);

  const timed = { ...counts, duration };
  const presentation = presentTool(first.toolName, first.args);
  if (tools.length === 1) {
    return header(presentation.icon, toolPhrases(presentation.label).done, presentation.detail, timed);
  }
  return header(presentation.icon, sentence(kindPhrases(tools)), undefined, timed);
}
