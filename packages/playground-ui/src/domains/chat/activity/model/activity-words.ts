import { Brain } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ActivityCall } from './activity-members';
import { presentTool, toolPhrases } from '@/ds/components/ai/tool-call';
import { formatDuration } from '@/utils/duration';

export interface ActivityWords {
  icon: LucideIcon;
  label: string;
  detail?: string;
  /** How long settled calls took, to the second: "1m 12s". A lone thought says it in its label. */
  duration?: string;
}

export interface CallsOutcome {
  failed: number;
  incomplete: number;
}

type WordedCall = Pick<ActivityCall, 'toolName' | 'args' | 'status'>;

const SUMMARY_KINDS = 3;

function secondsDuration(elapsedMs: number | undefined): string | undefined {
  if (elapsedMs === undefined || elapsedMs < 1_000) return undefined;
  return formatDuration(Math.round(elapsedMs / 1_000) * 1_000);
}

/** "Read files, ran a command": each kind once, in order of first use. */
function summarize(calls: readonly WordedCall[]): string {
  const counts = new Map<string, number>();
  for (const { toolName, args } of calls) {
    const { label } = presentTool(toolName, args);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const phrases = [...counts].map(([label, count]) => (count === 1 ? toolPhrases(label).one : toolPhrases(label).many));
  const rest = phrases.length - SUMMARY_KINDS;
  const said = rest > 0 ? [...phrases.slice(0, SUMMARY_KINDS), `and ${rest} more`] : phrases;
  const sentence = said.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** What the stretch is doing now: the latest running call, or thinking between calls. */
export function liveWords(calls: readonly WordedCall[]): ActivityWords {
  const running = calls.findLast(call => call.status === 'running');
  if (!running) return { icon: Brain, label: 'Thinking' };
  const { icon, label, detail, description } = presentTool(running.toolName, running.args);
  if (description) return { icon, label: description };
  return { icon, label: toolPhrases(label).live, detail };
}

/** What the stretch did: a lone call in the past tense, several as one sentence of kinds. */
export function settledWords(calls: readonly WordedCall[], elapsedMs?: number): ActivityWords {
  const duration = secondsDuration(elapsedMs);
  const [first] = calls;
  if (!first) return { icon: Brain, label: duration ? `Thought for ${duration}` : 'Thought' };
  const { icon, label, detail } = presentTool(first.toolName, first.args);
  if (calls.length === 1) return { icon, label: toolPhrases(label).done, detail, duration };
  return { icon, label: summarize(calls), duration };
}

/** The line's accessible name: what it says, as one phrase. */
export function wordsName({ label, detail, duration }: ActivityWords): string {
  const said = detail ? `${label} ${detail}` : label;
  return duration ? `${said}, ${duration}` : said;
}

export function callsOutcome(calls: readonly WordedCall[]): CallsOutcome {
  return {
    failed: calls.filter(call => call.status === 'error').length,
    incomplete: calls.filter(call => call.status === 'running').length,
  };
}

/** "1 failed · 2 incomplete" for several calls; a lone call only says it never finished. */
export function outcomeText({ failed, incomplete }: CallsOutcome, callCount: number): string {
  if (callCount <= 1) return incomplete > 0 ? 'incomplete' : '';
  const counts = [
    { count: failed, word: 'failed' },
    { count: incomplete, word: 'incomplete' },
  ];
  return counts
    .filter(({ count }) => count > 0)
    .map(({ count, word }) => `${count} ${word}`)
    .join(' · ');
}
