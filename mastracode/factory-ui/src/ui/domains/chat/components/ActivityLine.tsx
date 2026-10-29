import type { MastraMessagePart } from '@mastra/core/agent-controller';
import {
  Activity,
  ActivityDetail,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
} from '@mastra/playground-ui/components/ai/activity';
import type { ActivityStatus } from '@mastra/playground-ui/components/ai/activity';
import { callPose, liveWords } from '@mastra/playground-ui/domains/chat/activity';
import { isTaskTool } from '@mastra/playground-ui/components/ai/tool-call';
import { AgentIndicator } from '@mastra/playground-ui/components/AgentIndicator';
import type { AgentIndicatorState } from '@mastra/playground-ui/components/AgentIndicator';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useEffect, useState } from 'react';

import { useChatRuntime } from '../context/useChatRuntime';
import { useChatTranscript } from '../context/useChatTranscript';
import { omWork } from '../services/om';
import { isTerminalInvocationState } from '../services/transcript';
import type { TimelineEntry } from '../services/transcript';
import { Arriving } from '@mastra/playground-ui/components/Arrival';

interface RunningCall {
  toolName: string;
  args: unknown;
}

type RunActivity = 'memory' | 'thinking' | 'writing' | 'waiting' | 'done' | 'error' | RunningCall;

type LineState = Exclude<RunActivity, 'writing'>;

const LABELS: Record<Exclude<LineState, RunningCall>, string> = {
  memory: 'Updating memory',
  thinking: 'Thinking',
  waiting: 'Waiting for you',
  done: 'Done',
  error: 'Something went wrong',
};

const STATUS: Record<Exclude<LineState, RunningCall>, ActivityStatus> = {
  memory: 'running',
  thinking: 'running',
  waiting: 'idle',
  done: 'idle',
  error: 'error',
};

function spokenByStretch(state: LineState): boolean {
  return state === 'thinking' || typeof state !== 'string';
}

interface LineLook {
  pose: AgentIndicatorState;
  label: string;
  detail?: string;
  status: ActivityStatus;
}

function lineLook(state: LineState): LineLook {
  if (typeof state === 'string') return { pose: state, label: LABELS[state], status: STATUS[state] };
  const { label, detail } = liveWords([{ ...state, status: 'running' }]);
  return { pose: callPose(state.toolName), label, detail, status: 'running' };
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
function runActivity(entries: TimelineEntry[]): RunActivity {
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

function lineState(activity: RunActivity, busy: boolean, savingMemory: boolean): RunActivity {
  if (activity === 'waiting' || activity === 'error') return activity;
  if (!busy) return 'done';
  return savingMemory ? 'memory' : activity;
}

/** Long enough for done or error to land, hold, and fade before the line leaves the tree. */
const LINGER_MS = 1500;

/** True while `on`, and for a moment after it turns off — the room an exit needs to play. */
function useLinger(on: boolean): boolean {
  const [linger, setLinger] = useState(false);
  if (on && !linger) setLinger(true);

  useEffect(() => {
    if (on || !linger) return;
    const timer = setTimeout(() => setLinger(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [on, linger]);

  return on || linger;
}

/**
 * The agent's state for the whole run: what it is doing while it works, a held prompt while it
 * waits on the user, then done or error for a beat before the line fades out.
 */
export function ActivityLine({ stretchLive }: { stretchLive: boolean }) {
  const { busy, transcript } = useChatTranscript();
  const runtime = useChatRuntime();
  const activity = runActivity(transcript.entries);
  const live = busy || activity === 'waiting';
  const shown = useLinger(live);
  if (!shown) return null;

  const state = lineState(activity, busy, Object.values(omWork(runtime)).includes('blocking'));
  if (state === 'writing' || (stretchLive && spokenByStretch(state))) return null;
  return <RunLine state={state} live={live} />;
}

/** Born done = the answer or a stretch already said the run is over. */
function RunLine({ state, live }: { state: LineState; live: boolean }) {
  const [bornDone] = useState(state === 'done');
  if (bornDone) return null;
  const { pose, label, detail, status } = lineLook(state);

  return (
    <Arriving>
      <div
        aria-hidden
        className={cn('transition-opacity duration-300 motion-reduce:duration-0', !live && 'opacity-0 delay-1100')}
      >
        <Activity foldable={false} status={status} appearance="inline">
          <ActivityHeader>
            <ActivityIcon className="[&_svg]:size-4">
              <AgentIndicator state={pose} />
            </ActivityIcon>
            <ActivityLabel className="text-body font-medium">{label}</ActivityLabel>
            {detail && <ActivityDetail className="text-body-sm">{detail}</ActivityDetail>}
          </ActivityHeader>
        </Activity>
      </div>
    </Arriving>
  );
}
