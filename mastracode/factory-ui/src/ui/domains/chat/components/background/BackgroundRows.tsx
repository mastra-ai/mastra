import {
  Activity,
  ActivityContent,
  ActivityHeadline,
  ActivityTrailing,
  ActivityTrigger,
} from '@mastra/playground-ui/components/ai/activity';
import type { ActivityStatus } from '@mastra/playground-ui/components/ai/activity';
import {
  presentTool,
  stripAnsi,
  ToolCallExitStatus,
  ToolCallOutput,
} from '@mastra/playground-ui/components/ai/tool-call';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useElapsedTime } from '@mastra/playground-ui/hooks/use-elapsed-time';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import type { ReactNode } from 'react';

import type { ToolCall } from '../../services/transcript';
import { ToolBody, toolHasBody } from '../tool/ToolBody';
import { ToolCard } from '../tool/ToolCard';
import { backgroundLaunchPid } from './background-work';
import type { BackgroundFinishedNotice } from './background-work';
import { useBackgroundWork } from './BackgroundWorkProvider';

/** Marks a call whose work goes on after it returned. It pulses only while the work is known to run. */
export function BackgroundTag({ live }: { live: boolean }) {
  return (
    <Badge size="xs" variant="info" emphasis="subtle" indicator={live ? 'pulse' : undefined}>
      Background
    </Badge>
  );
}

/** The quiet trailing text of a background row: elapsed time, exit code, how it ended. */
export function MutedMeta({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="meta" tone="muted" className="px-1 tabular-nums">
      {children}
    </Txt>
  );
}

/** How long background work has run, counted from when it started on the server. */
export function RunningFor({ startedAt }: { startedAt: number }) {
  const elapsed = useElapsedTime(true, startedAt);
  return <MutedMeta>{formatDuration(Math.max(0, elapsed))}</MutedMeta>;
}

/** A background process's exit code, shown even when it is 0: its end came long after the call. */
function ExitCode({ exitCode }: { exitCode: number }) {
  if (exitCode !== 0) return <ToolCallExitStatus exit={{ exitCode }} />;
  return <MutedMeta>exit 0</MutedMeta>;
}

type CommandState =
  | { phase: 'running'; startedAt?: number }
  | { phase: 'exited'; exitCode: number }
  /** Nothing to ask yet, or the sandbox couldn't be read. */
  | { phase: 'pending' }
  /**
   * Not listed, with no exit on record. Its output may have been read or its sandbox restarted, but it may also
   * run on a replica this request didn't reach, so it isn't called ended.
   */
  | { phase: 'unknown' };

function useCommandState(tool: ToolCall, pid: string): CommandState {
  const work = useBackgroundWork();
  const exitCode = work?.exits.get(tool.toolCallId);
  if (exitCode !== undefined) return { phase: 'exited', exitCode };
  if (!work?.processes) return { phase: 'pending' };
  // PIDs come back after a sandbox restart, so the listed process must also be this call's.
  const listed = work.processes.find(
    process => process.pid === pid && (process.metadata?.toolCallId ?? tool.toolCallId) === tool.toolCallId,
  );
  if (listed?.running) return { phase: 'running', startedAt: listed.metadata?.startedAt };
  if (listed?.exitCode !== undefined) return { phase: 'exited', exitCode: listed.exitCode };
  return { phase: 'unknown' };
}

function rowStatus(state: CommandState): ActivityStatus {
  if (state.phase === 'running') return 'running';
  return state.phase === 'exited' && state.exitCode !== 0 ? 'error' : 'idle';
}

function CommandOutcome({ state }: { state: CommandState }) {
  if (state.phase === 'running')
    return state.startedAt === undefined ? null : <RunningFor startedAt={state.startedAt} />;
  if (state.phase === 'exited') return <ExitCode exitCode={state.exitCode} />;
  return null;
}

function LaunchedCommandRow({ tool, pid }: { tool: ToolCall; pid: string }) {
  const state = useCommandState(tool, pid);
  const { icon: ToolIcon, label, detail, description, command } = presentTool(tool.toolName, tool.args);
  const foldable = toolHasBody(tool, command);
  const showsTag = state.phase === 'running' || state.phase === 'pending';
  return (
    <Activity
      appearance="inline"
      foldable={foldable}
      status={rowStatus(state)}
      aria-label={`Background command: ${description ?? detail ?? label}`}
    >
      <div className="flex w-full min-w-0 items-center">
        <ActivityTrigger className="min-w-0 flex-1">
          <ActivityHeadline
            icon={<ToolIcon aria-hidden />}
            label={label}
            detail={detail}
            description={description}
            badges={showsTag ? <BackgroundTag live={state.phase === 'running'} /> : undefined}
          />
        </ActivityTrigger>
        <ActivityTrailing>
          <CommandOutcome state={state} />
        </ActivityTrailing>
      </div>
      <ActivityContent>
        <ToolBody tool={tool} command={command} />
      </ActivityContent>
    </Activity>
  );
}

/**
 * An `execute_command` call that started a background process, drawn by how the process stands rather than
 * by the call, which returned at once. A launch that never got a process draws as an ordinary call.
 */
export function BackgroundCommandRow({ tool }: { tool: ToolCall }) {
  const pid = tool.status === 'done' ? backgroundLaunchPid(tool.result) : undefined;
  return pid ? <LaunchedCommandRow tool={tool} pid={pid} /> : <ToolCard tool={tool} />;
}

/** A call handed to a background task that has not ended: its part holds a placeholder until the task does. */
export function BackgroundTaskRow({ tool }: { tool: ToolCall }) {
  const { icon: ToolIcon, label, detail, description } = presentTool(tool.toolName, tool.args);
  return (
    <Activity appearance="inline" foldable={false} status="running" aria-label={`Background task: ${label}`}>
      <ActivityTrigger>
        <ActivityHeadline
          icon={<ToolIcon aria-hidden />}
          label={label}
          detail={detail}
          description={description}
          badges={<BackgroundTag live />}
        />
      </ActivityTrigger>
    </Activity>
  );
}

const TASK_ENDINGS: Record<string, { label: string; status: ActivityStatus }> = {
  completed: { label: 'Task finished', status: 'idle' },
  failed: { label: 'Task failed', status: 'error' },
  cancelled: { label: 'Task cancelled', status: 'idle' },
};

/** The row an exit or end notice draws: the work ended, apart from the call that started it. */
export function BackgroundFinishedRow({ notice }: { notice: BackgroundFinishedNotice }) {
  const process = notice.kind === 'process';
  const ending = process
    ? { label: 'Command finished', status: notice.exitCode === 0 ? ('idle' as const) : ('error' as const) }
    : (TASK_ENDINGS[notice.status] ?? TASK_ENDINGS.failed);
  const detail = process ? (notice.summary ?? `PID ${notice.pid}`) : (notice.summary ?? notice.title);
  const { icon: Icon } = presentTool(process ? 'execute_command' : (notice.toolName ?? ''), {});
  return (
    <Activity
      foldable={notice.text.length > 0}
      status={ending.status}
      aria-label={detail ? `${ending.label}: ${detail}` : ending.label}
    >
      <div className="flex w-full min-w-0 items-center">
        <ActivityTrigger className="min-w-0 flex-1">
          <ActivityHeadline
            leading={
              <Txt as="span" variant="caption" tone="muted" aria-hidden>
                ↳
              </Txt>
            }
            icon={<Icon aria-hidden />}
            label={ending.label}
            detail={detail}
          />
        </ActivityTrigger>
        {process && (
          <ActivityTrailing className="pr-1">
            <ExitCode exitCode={notice.exitCode} />
          </ActivityTrailing>
        )}
      </div>
      {notice.text && (
        <ActivityContent>
          <ToolCallOutput text={stripAnsi(notice.text)} />
        </ActivityContent>
      )}
    </Activity>
  );
}
