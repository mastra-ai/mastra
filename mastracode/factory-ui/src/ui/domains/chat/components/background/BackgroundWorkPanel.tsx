import {
  Activity,
  ActivityContent,
  ActivityHeadline,
  ActivityTrailing,
  ActivityTrigger,
} from '@mastra/playground-ui/components/ai/activity';
import { TaskListContainer, TaskListStatusIcon } from '@mastra/playground-ui/components/ai/task-list';
import { presentTool, stripAnsi, ToolCallOutput } from '@mastra/playground-ui/components/ai/tool-call';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Square } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { BackgroundProcess } from '../../services/background-work';
import type { RunningBackgroundTask } from './background-work';
import { RunningFor } from './BackgroundRows';
import { useBackgroundProcessOutput, useBackgroundWork, useKillBackgroundProcess } from './BackgroundWorkProvider';
import type { BackgroundWorkApi } from './BackgroundWorkProvider';

/** Stops a running background command once the reader confirms: it can't be resumed. */
function StopButton({
  action,
  title,
  description,
  pending,
  onConfirm,
}: {
  action: string;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        tooltip={action}
        aria-label={action}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <Square />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            <AlertDialog.Description>{description}</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Keep running</AlertDialog.Cancel>
            <AlertDialog.Action onClick={onConfirm}>{action}</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}

function WorkRow({
  icon,
  label,
  detail,
  startedAt,
  stop,
  open,
  onOpenChange,
  children,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  startedAt?: number;
  stop?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <li>
      <Activity
        foldable={children !== undefined}
        open={open}
        onOpenChange={onOpenChange}
        aria-label={detail ? `${label}: ${detail}` : label}
      >
        <div className="flex w-full min-w-0 items-center">
          <ActivityTrigger className="min-w-0 flex-1">
            <ActivityHeadline
              leading={<TaskListStatusIcon status="in_progress" />}
              icon={icon}
              label={label}
              detail={detail}
            />
          </ActivityTrigger>
          <ActivityTrailing className="gap-1 pr-1">
            {startedAt !== undefined && <RunningFor startedAt={startedAt} />}
            {stop}
          </ActivityTrailing>
        </div>
        {children !== undefined && <ActivityContent>{children}</ActivityContent>}
      </Activity>
    </li>
  );
}

function ProcessOutput({ work, pid }: { work: BackgroundWorkApi; pid: string }) {
  const { data, error, isPending } = useBackgroundProcessOutput(work, pid);
  const note = (text: string) => (
    <Txt variant="caption" tone="muted">
      {text}
    </Txt>
  );
  if (isPending) return note('Reading output…');
  // The sandbox forgets a process once its output is read after exit, or when the sandbox restarts.
  if (error) return note('status' in error && error.status === 404 ? 'Output is no longer available.' : error.message);
  const stdout = stripAnsi(data.stdout).trimEnd();
  const stderr = stripAnsi(data.stderr).trimEnd();
  if (!stdout && !stderr) return note('No output yet');
  return (
    <>
      {note('Latest output')}
      {stdout && <ToolCallOutput text={stdout} />}
      {stderr && <ToolCallOutput text={stderr} error />}
    </>
  );
}

function ProcessRow({
  work,
  process,
  toolCallId,
}: {
  work: BackgroundWorkApi;
  process: BackgroundProcess;
  toolCallId: string;
}) {
  const [open, setOpen] = useState(false);
  const kill = useKillBackgroundProcess(work);
  const { icon: Icon, label, detail } = presentTool('execute_command', { command: process.command });
  const name = detail ?? `PID ${process.pid}`;
  return (
    <WorkRow
      icon={<Icon aria-hidden />}
      label={label}
      detail={name}
      startedAt={process.metadata?.startedAt}
      open={open}
      onOpenChange={setOpen}
      stop={
        <StopButton
          action="Stop command"
          title="Stop this command?"
          description={`${name} stops now. The agent isn't told it exited.`}
          pending={kill.isPending}
          onConfirm={() =>
            kill.mutate(
              { pid: process.pid, toolCallId },
              { onError: error => toast.error(`Couldn't stop the command: ${error.message}`) },
            )
          }
        />
      }
    >
      {open ? <ProcessOutput work={work} pid={process.pid} /> : null}
    </WorkRow>
  );
}

/** A call the agent handed to a background task. Shown for what it is; it isn't stopped from here. */
function TaskRow({ task }: { task: RunningBackgroundTask }) {
  const { icon: Icon, label, detail } = presentTool(task.toolName, task.args);
  return <WorkRow icon={<Icon aria-hidden />} label={label} detail={detail} />;
}

/**
 * The thread's running background work, docked above the composer: commands the agent left running in the
 * session's sandbox, which can be stopped, and tasks it handed to the background. Hidden while nothing runs.
 */
export function BackgroundWorkPanel() {
  const work = useBackgroundWork();
  if (!work) return null;
  // Every listed command names the call that started it; that call, not the PID alone, is what a stop targets.
  const processes = (work.processes ?? []).flatMap(process => {
    const toolCallId = process.metadata?.toolCallId;
    return process.running && toolCallId && !work.exits.has(toolCallId) ? [{ process, toolCallId }] : [];
  });
  if (processes.length === 0 && work.tasks.length === 0) return null;

  return (
    <TaskListContainer aria-label="Background work" data-testid="background-work-panel">
      <ul className="flex flex-col px-1.5 py-1">
        {work.tasks.map(task => (
          <TaskRow key={task.taskId} task={task} />
        ))}
        {processes.map(({ process, toolCallId }) => (
          <ProcessRow key={toolCallId} work={work} process={process} toolCallId={toolCallId} />
        ))}
      </ul>
    </TaskListContainer>
  );
}
