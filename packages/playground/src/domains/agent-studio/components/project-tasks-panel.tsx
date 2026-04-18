import type { ProjectResponse, ProjectTaskResponse } from '@mastra/client-js';
import { Button, Txt } from '@mastra/playground-ui';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useProjectMutations } from '../hooks/use-projects';

interface ProjectTasksPanelProps {
  project: ProjectResponse;
}

const STATUS_ORDER: ProjectTaskResponse['status'][] = ['open', 'in_progress', 'blocked', 'done'];

const statusLabels: Record<ProjectTaskResponse['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export function ProjectTasksPanel({ project }: ProjectTasksPanelProps) {
  const { addTask, updateTask, deleteTask } = useProjectMutations(project.id);
  const [newTitle, setNewTitle] = useState('');

  const tasks = [...(project.project?.tasks ?? [])].sort((a, b) => {
    const aIdx = STATUS_ORDER.indexOf(a.status);
    const bIdx = STATUS_ORDER.indexOf(b.status);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      await addTask.mutateAsync({ title });
      setNewTitle('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add task');
    }
  };

  const handleToggle = async (task: ProjectTaskResponse) => {
    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        params: { status: task.status === 'done' ? 'open' : 'done' },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  return (
    <aside className="flex flex-col gap-3 p-3 h-full" data-testid="project-tasks-panel">
      <div className="flex items-center justify-between">
        <Txt variant="ui-md">Tasks</Txt>
        <Txt variant="ui-sm" className="text-icon3">
          {tasks.filter(t => t.status === 'done').length}/{tasks.length}
        </Txt>
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          data-testid="project-task-input"
          className="flex-1 bg-surface3 border border-border1 rounded-md px-2 py-1.5 text-sm"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="New task"
        />
        <Button type="submit" variant="light" size="sm" data-testid="project-task-add">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {tasks.length === 0 ? (
        <Txt variant="ui-sm" className="text-icon3 py-4 text-center">
          No tasks yet. Add one above or ask the supervisor to add one for you.
        </Txt>
      ) : (
        <ul className="flex flex-col gap-1.5 overflow-auto">
          {tasks.map(task => {
            const done = task.status === 'done';
            return (
              <li
                key={task.id}
                data-testid={`project-task-${task.id}`}
                className="flex items-start gap-2 bg-surface3 rounded-md px-2 py-1.5 group"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(task)}
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                    done ? 'bg-accent1 border-accent1 text-white' : 'border-border1'
                  }`}
                  aria-label={done ? 'Mark as not done' : 'Mark as done'}
                  data-testid={`project-task-toggle-${task.id}`}
                >
                  {done && <Check className="h-3 w-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${done ? 'line-through text-icon3' : ''}`}>{task.title}</div>
                  {task.description && <div className="text-xs text-icon3 mt-0.5">{task.description}</div>}
                  {task.status !== 'open' && task.status !== 'done' && (
                    <div className="text-xs text-icon3 mt-0.5">{statusLabels[task.status]}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-icon3 hover:text-icon5"
                  aria-label="Delete task"
                  data-testid={`project-task-delete-${task.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
