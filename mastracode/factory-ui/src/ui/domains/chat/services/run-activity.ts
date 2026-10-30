import type { MastraMessagePart } from '@mastra/core/agent-controller';
import type { ActivityStatus } from '@mastra/playground-ui/components/ai/activity';
import { isTaskTool } from '@mastra/playground-ui/components/ai/tool-call';

import { isTerminalInvocationState } from './transcript';
import type { TimelineEntry } from './transcript';

export interface RunningCall {
  toolName: string;
  args: unknown;
}

export type RunActivity = 'memory' | 'thinking' | 'writing' | 'waiting' | 'done' | 'error' | RunningCall;

export type LineState = Exclude<RunActivity, 'writing'>;

export const LABELS: Record<Exclude<LineState, RunningCall>, string> = {
  memory: 'Updating memory',
  thinking: 'Thinking',
  waiting: 'Waiting for you',
  done: 'Done',
  error: 'Something went wrong',
};

export const STATUS: Record<Exclude<LineState, RunningCall>, ActivityStatus> = {
  memory: 'running',
  thinking: 'running',
  waiting: 'idle',
  done: 'idle',
  error: 'error',
};

export function spokenByStretch(state: LineState): boolean {
  return state === 'thinking' || typeof state !== 'string';
}

/**
 * Parts the transcript puts on screen. A hidden tool draws nothing, and an `ask_user` is drawn
 * by its suspension prompt — until that prompt lands, its row renders nothing at all.
 */
function partIsDrawn(part: MastraMessagePart): boolean {
  switch (part.type) {
    case 'text':
      return part.text.trim().length > 0;
    case 'reasoning':
      return part.reasoning.trim().length > 0;
    case 'file':
      return true;
    case 'tool-invocation': {
      const { toolName, state } = part.toolInvocation;
      if (isTaskTool(toolName)) return false;
      return toolName !== 'ask_user' || isTerminalInvocationState(state);
    }
    default:
      return false;
  }
}

/** A finished call hands the turn back to the model. */
function partActivity(part: MastraMessagePart): RunActivity {
  if (part.type === 'text') return 'writing';
  if (part.type !== 'tool-invocation' || isTerminalInvocationState(part.toolInvocation.state)) return 'thinking';
  return part.toolInvocation;
}

/**
 * What the run is doing, read from the newest thing it put on screen since the user spoke. A prompt
 * lands after the message holding its call, so walking back meets the prompt first.
 */
export function runActivity(entries: TimelineEntry[]): RunActivity {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.kind === 'approval' || entry.kind === 'suspension') return 'waiting';
    if (entry.kind === 'notice' && entry.level === 'error') return 'error';
    if (entry.kind !== 'message') continue;
    if (entry.message.role === 'user') return 'thinking';
    if (entry.message.role !== 'assistant') continue;
    const { parts } = entry.message.content;
    if (parts.some(part => part.type === 'error')) return 'error';
    const drawn = parts.findLast(partIsDrawn);
    if (drawn) return partActivity(drawn);
  }
  return 'thinking';
}

export function lineState(activity: RunActivity, busy: boolean, savingMemory: boolean): RunActivity {
  if (activity === 'waiting' || activity === 'error') return activity;
  if (!busy) return 'done';
  if (activity === 'writing' || !savingMemory) return activity;
  return 'memory';
}
