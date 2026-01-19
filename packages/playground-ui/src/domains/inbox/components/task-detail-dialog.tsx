import type { Task } from '@mastra/core';
import { SideDialog } from '@/ds/components/SideDialog';
import { KeyValueList, type KeyValueListItemData } from '@/ds/components/KeyValueList';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { Section } from '@/ds/components/Section';
import { Sections } from '@/ds/components/Sections';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Icon } from '@/ds/icons/Icon';
import { TaskStatusBadge } from './task-status-badge';
import { TaskPriorityBadge } from './task-priority-badge';
import {
  InboxIcon,
  HashIcon,
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
  FileInputIcon,
  FileOutputIcon,
  AlertTriangleIcon,
  BracesIcon,
  ExternalLinkIcon,
  XIcon,
  RotateCcwIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { formatDistanceToNow, format } from 'date-fns';

export type TaskDetailDialogProps = {
  task?: Task | null;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onCancel?: (taskId: string) => void;
  onRelease?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  isLoading?: boolean;
};

export function TaskDetailDialog({
  task,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onCancel,
  onRelease,
  onResume,
  isLoading,
}: TaskDetailDialogProps) {
  const { Link } = useLinkComponent();

  if (!task && !isLoading) {
    return null;
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return `${format(d, 'MMM d, yyyy HH:mm:ss')} (${formatDistanceToNow(d, { addSuffix: true })})`;
  };

  const taskInfo: KeyValueListItemData[] = task
    ? [
        {
          key: 'id',
          label: 'ID',
          value: task.id,
          icon: <HashIcon />,
        },
        {
          key: 'type',
          label: 'Type',
          value: task.type,
          icon: <InboxIcon />,
        },
        {
          key: 'status',
          label: 'Status',
          value: <TaskStatusBadge status={task.status} />,
          icon: <CheckCircleIcon />,
        },
        {
          key: 'priority',
          label: 'Priority',
          value: <TaskPriorityBadge priority={task.priority} />,
          icon: <AlertTriangleIcon />,
        },
        ...(task.targetAgentId
          ? [
              {
                key: 'targetAgent',
                label: 'Target Agent',
                value: task.targetAgentId,
                icon: <PlayIcon />,
              },
            ]
          : []),
        ...(task.claimedBy
          ? [
              {
                key: 'claimedBy',
                label: 'Claimed By',
                value: task.claimedBy,
                icon: <PlayIcon />,
              },
            ]
          : []),
        ...(task.runId
          ? [
              {
                key: 'runId',
                label: 'Run ID',
                value: task.runId,
                icon: <HashIcon />,
              },
            ]
          : []),
        ...(task.sourceId
          ? [
              {
                key: 'sourceId',
                label: 'Source ID',
                value: task.sourceUrl ? (
                  <a
                    href={task.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    {task.sourceId} <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                ) : (
                  task.sourceId
                ),
                icon: <ExternalLinkIcon />,
              },
            ]
          : []),
      ]
    : [];

  const timingInfo: KeyValueListItemData[] = task
    ? [
        {
          key: 'createdAt',
          label: 'Created',
          value: formatDate(task.createdAt),
          icon: <ClockIcon />,
        },
        ...(task.claimedAt
          ? [
              {
                key: 'claimedAt',
                label: 'Claimed',
                value: formatDate(task.claimedAt),
                icon: <ClockIcon />,
              },
            ]
          : []),
        ...(task.startedAt
          ? [
              {
                key: 'startedAt',
                label: 'Started',
                value: formatDate(task.startedAt),
                icon: <PlayIcon />,
              },
            ]
          : []),
        ...(task.completedAt
          ? [
              {
                key: 'completedAt',
                label: 'Completed',
                value: formatDate(task.completedAt),
                icon: <CheckCircleIcon />,
              },
            ]
          : []),
        ...(task.suspendedAt
          ? [
              {
                key: 'suspendedAt',
                label: 'Suspended',
                value: formatDate(task.suspendedAt),
                icon: <PauseCircleIcon />,
              },
            ]
          : []),
        {
          key: 'attempts',
          label: 'Attempts',
          value: `${task.attempts} / ${task.maxAttempts}`,
          icon: <RefreshCwIcon />,
        },
      ]
    : [];

  const canCancel = task && ['pending', 'claimed', 'in_progress'].includes(task.status);
  const canRelease = task && task.status === 'claimed';
  const canResume = task && task.status === 'waiting_for_input';

  return (
    <SideDialog
      dialogTitle="Task Details"
      dialogDescription="View task details and actions"
      isOpen={isOpen}
      onClose={onClose}
      level={2}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <InboxIcon /> {task ? getShortId(task.id) : 'Loading...'}
        </TextAndIcon>
        |
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
      </SideDialog.Top>

      <SideDialog.Content>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-neutral3">Loading task details...</div>
        ) : task ? (
          <Sections>
            <SideDialog.Header>
              <SideDialog.Heading>
                <InboxIcon /> {task.title || task.type}
              </SideDialog.Heading>

              <TextAndIcon>
                <HashIcon /> {task.id}
              </TextAndIcon>
            </SideDialog.Header>

            {/* Actions */}
            {(canCancel || canRelease || canResume) && (
              <div className="bg-surface3 p-4 rounded-lg">
                <h4 className="text-ui-md text-neutral3 mb-3">Actions</h4>
                <ButtonsGroup>
                  {canCancel && onCancel && (
                    <Button variant="outline" onClick={() => onCancel(task.id)}>
                      <Icon>
                        <XIcon />
                      </Icon>
                      Cancel Task
                    </Button>
                  )}
                  {canRelease && onRelease && (
                    <Button variant="outline" onClick={() => onRelease(task.id)}>
                      <Icon>
                        <RotateCcwIcon />
                      </Icon>
                      Release Task
                    </Button>
                  )}
                  {canResume && onResume && (
                    <Button variant="default" onClick={() => onResume(task.id)}>
                      <Icon>
                        <PlayIcon />
                      </Icon>
                      Resume Task
                    </Button>
                  )}
                </ButtonsGroup>
              </div>
            )}

            {/* Task Info */}
            <Section>
              <Section.Header>
                <Section.Heading>
                  <InboxIcon /> Task Information
                </Section.Heading>
              </Section.Header>
              <KeyValueList data={taskInfo} LinkComponent={Link} />
            </Section>

            {/* Timing */}
            <Section>
              <Section.Header>
                <Section.Heading>
                  <ClockIcon /> Timeline
                </Section.Heading>
              </Section.Header>
              <KeyValueList data={timingInfo} LinkComponent={Link} />
            </Section>

            {/* Error */}
            {task.error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <XCircleIcon className="text-red-400 mt-0.5 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-400 mb-1 text-sm">Error</h4>
                    <p className="text-sm text-neutral3 whitespace-pre-wrap">{task.error.message}</p>
                    {task.error.stack && (
                      <pre className="mt-2 text-xs text-neutral3 bg-surface1 p-2 rounded overflow-x-auto">
                        {task.error.stack}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payload */}
            <SideDialog.CodeSection
              title="Payload"
              icon={<FileInputIcon />}
              codeStr={JSON.stringify(task.payload || null, null, 2)}
            />

            {/* Result */}
            {task.result !== undefined && (
              <SideDialog.CodeSection
                title="Result"
                icon={<FileOutputIcon />}
                codeStr={JSON.stringify(task.result, null, 2)}
              />
            )}

            {/* Suspend Payload (for waiting_for_input) */}
            {task.suspendPayload !== undefined && (
              <SideDialog.CodeSection
                title="Suspend Payload"
                icon={<PauseCircleIcon />}
                codeStr={JSON.stringify(task.suspendPayload, null, 2)}
              />
            )}

            {/* Resume Payload (if resumed) */}
            {task.resumePayload !== undefined && (
              <SideDialog.CodeSection
                title="Resume Payload"
                icon={<PlayIcon />}
                codeStr={JSON.stringify(task.resumePayload, null, 2)}
              />
            )}

            {/* Metadata */}
            {task.metadata && Object.keys(task.metadata).length > 0 && (
              <SideDialog.CodeSection
                title="Metadata"
                icon={<BracesIcon />}
                codeStr={JSON.stringify(task.metadata, null, 2)}
              />
            )}
          </Sections>
        ) : null}
      </SideDialog.Content>
    </SideDialog>
  );
}
