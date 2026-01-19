import { useState } from 'react';
import type { CreateTaskInput, TaskPriority } from '@mastra/core/inbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { PlusIcon } from 'lucide-react';

export interface AddTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: CreateTaskInput) => void;
  isLoading?: boolean;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 0, label: 'Low' },
  { value: 1, label: 'Normal' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Urgent' },
];

export function AddTaskDialog({ isOpen, onClose, onAdd, isLoading }: AddTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(1);

  const handleAdd = () => {
    if (!title.trim()) {
      return;
    }

    onAdd({
      type: 'task',
      title: title.trim(),
      priority,
      payload: { description: description.trim() || undefined },
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle('');
      setDescription('');
      setPriority(1);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Add Task
          </DialogTitle>
          <DialogDescription>Create a new task for an agent to process.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-neutral2">
              What do you need help with?
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg bg-surface2 border border-border1 p-3 text-sm text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1"
              placeholder="e.g., Review the Q4 sales report"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-neutral2">
              Details <span className="text-text3">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full h-24 rounded-lg bg-surface2 border border-border1 p-3 text-sm text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1 resize-none"
              placeholder="Add any additional context or instructions..."
            />
            <p className="text-xs text-text3">Markdown supported</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="priority" className="text-sm font-medium text-neutral2">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={e => setPriority(Number(e.target.value) as TaskPriority)}
              className="w-full rounded-lg bg-surface2 border border-border1 p-3 text-sm text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1"
            >
              {PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isLoading || !title.trim()}>
              {isLoading ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
