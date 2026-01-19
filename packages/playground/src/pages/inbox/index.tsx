import { useState } from 'react';
import { InboxIcon } from 'lucide-react';
import type { Task } from '@mastra/core';
import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  DocsIcon,
  useLinkComponent,
  TasksTable,
  InboxSelector,
  InboxStatsDisplay,
  TaskDetailDialog,
  ResumeTaskDialog,
  useInboxes,
  useTasks,
  useInboxStats,
  useCancelTask,
  useRetryTask,
  useResumeTask,
} from '@mastra/playground-ui';

function Inbox() {
  const { Link } = useLinkComponent();
  const { data: inboxes = [], isLoading: isLoadingInboxes } = useInboxes();
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [resumeTask, setResumeTask] = useState<Task | null>(null);

  // Auto-select first inbox if none selected
  const activeInboxId = selectedInboxId ?? inboxes[0]?.id ?? null;

  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks(activeInboxId ?? '');
  const { data: stats, isLoading: isLoadingStats } = useInboxStats(activeInboxId ?? '');

  const cancelTaskMutation = useCancelTask(activeInboxId ?? '');
  const releaseTaskMutation = useRetryTask(activeInboxId ?? '');
  const resumeTaskMutation = useResumeTask(activeInboxId ?? '');

  const isLoading = isLoadingInboxes || (activeInboxId && isLoadingTasks);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCloseDialog = () => {
    setSelectedTask(null);
  };

  const handleCancelTask = (taskId: string) => {
    cancelTaskMutation.mutate(taskId, {
      onSuccess: () => {
        setSelectedTask(null);
      },
    });
  };

  const handleReleaseTask = (taskId: string) => {
    releaseTaskMutation.mutate(taskId, {
      onSuccess: () => {
        setSelectedTask(null);
      },
    });
  };

  const handleOpenResumeDialog = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setResumeTask(task);
    }
  };

  const handleCloseResumeDialog = () => {
    setResumeTask(null);
  };

  const handleResumeTask = (taskId: string, payload: unknown) => {
    resumeTaskMutation.mutate(
      { taskId, payload },
      {
        onSuccess: () => {
          setResumeTask(null);
          setSelectedTask(null);
        },
      },
    );
  };

  // Navigate to next/previous task in the list
  const currentTaskIndex = selectedTask ? tasks.findIndex(t => t.id === selectedTask.id) : -1;

  const handleNextTask =
    currentTaskIndex >= 0 && currentTaskIndex < tasks.length - 1
      ? () => setSelectedTask(tasks[currentTaskIndex + 1])
      : undefined;

  const handlePreviousTask = currentTaskIndex > 0 ? () => setSelectedTask(tasks[currentTaskIndex - 1]) : undefined;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <InboxIcon />
          </Icon>
          Inbox
        </HeaderTitle>

        <HeaderAction>
          <InboxSelector
            inboxes={inboxes.map(inbox => ({ id: inbox.id, name: inbox.name ?? inbox.id }))}
            selectedInboxId={activeInboxId}
            onSelect={setSelectedInboxId}
            isLoading={isLoadingInboxes}
          />
          <Button as={Link} to="https://mastra.ai/en/docs/inbox/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Inbox documentation
          </Button>
        </HeaderAction>
      </Header>

      {activeInboxId && stats && (
        <div className="px-6 py-4 border-b border-border1">
          <InboxStatsDisplay stats={stats} isLoading={isLoadingStats} />
        </div>
      )}

      <MainContentContent isCentered={!isLoading && tasks.length === 0}>
        {activeInboxId ? (
          <TasksTable
            tasks={tasks}
            inboxId={activeInboxId}
            isLoading={!!isLoadingTasks}
            onTaskClick={handleTaskClick}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text3">
            {isLoadingInboxes ? 'Loading inboxes...' : 'No inboxes configured'}
          </div>
        )}
      </MainContentContent>

      <TaskDetailDialog
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={handleCloseDialog}
        onNext={handleNextTask}
        onPrevious={handlePreviousTask}
        onCancel={handleCancelTask}
        onRelease={handleReleaseTask}
        onResume={handleOpenResumeDialog}
      />

      <ResumeTaskDialog
        task={resumeTask}
        isOpen={!!resumeTask}
        onClose={handleCloseResumeDialog}
        onResume={handleResumeTask}
        isLoading={resumeTaskMutation.isPending}
      />
    </MainContentLayout>
  );
}

export default Inbox;
