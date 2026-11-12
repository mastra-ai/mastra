import type { ReactNode } from 'react';
import { signalContentsToText } from '../messages/signal-data';
import type { SignalData } from '../messages/signal-data';
import { WORKSPACE_TOOLS } from '../tools/workspace-tool-constants';
import { processExitNotice, taskNotice } from './background-notices';
import { ExitCode } from './exit-code';
import {
  Activity,
  ActivityContent,
  ActivityHeadline,
  ActivityTrailing,
  ActivityTrigger,
} from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { presentTool, stripAnsi, ToolCallOutput } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';

interface FinishedRowProps {
  toolName: string;
  label: string;
  detail?: string;
  status: ActivityStatus;
  outcome?: ReactNode;
  message: string;
  defaultOpen?: boolean;
}

function FinishedRow({ toolName, label, detail, status, outcome, message, defaultOpen }: FinishedRowProps) {
  const { icon: Icon } = presentTool(toolName, {});
  return (
    <Activity
      defaultOpen={defaultOpen}
      foldable={message.length > 0}
      status={status}
      aria-label={detail ? `${label}: ${detail}` : label}
      data-testid="background-finished-notice"
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
            label={label}
            detail={detail}
          />
        </ActivityTrigger>
        {outcome && <ActivityTrailing className="pr-1">{outcome}</ActivityTrailing>}
      </div>
      {message && (
        <ActivityContent>
          <ToolCallOutput text={stripAnsi(message)} />
        </ActivityContent>
      )}
    </Activity>
  );
}

/**
 * The row a background process's exit notice or a background task's notice draws: the work ended, apart
 * from the call that started it. Undefined for any other signal.
 */
export function BackgroundFinishedNotice({ signal, defaultOpen }: { signal: SignalData; defaultOpen?: boolean }) {
  const message = signalContentsToText(signal.contents);
  const exit = processExitNotice(signal);
  if (exit) {
    return (
      <FinishedRow
        toolName={WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND}
        label="Command finished"
        detail={exit.command ?? `PID ${exit.pid}`}
        status={exit.exitCode === 0 ? 'idle' : 'error'}
        outcome={<ExitCode exitCode={exit.exitCode} />}
        message={message}
        defaultOpen={defaultOpen}
      />
    );
  }
  const task = taskNotice(signal);
  if (!task) return null;
  const failed = task.status !== 'completed';
  return (
    <FinishedRow
      toolName={task.toolName ?? ''}
      label={failed ? 'Task failed' : 'Task finished'}
      detail={task.toolName}
      status={failed ? 'error' : 'idle'}
      message={message}
      defaultOpen={defaultOpen}
    />
  );
}
