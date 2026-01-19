import { useState } from 'react';
import type { CreateTaskInput, TaskPriority } from '@mastra/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { PlusIcon, AlertCircleIcon } from 'lucide-react';

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
  const [type, setType] = useState('task');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(1);
  const [payloadText, setPayloadText] = useState('{}');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!type.trim()) {
      setError('Type is required');
      return;
    }

    try {
      const payload = JSON.parse(payloadText);
      setError(null);
      onAdd({
        type: type.trim(),
        title: title.trim() || undefined,
        priority,
        payload,
      });
    } catch {
      setError('Invalid JSON. Please enter valid JSON for the payload.');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setType('task');
      setTitle('');
      setPriority(1);
      setPayloadText('{}');
      setError(null);
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
          <DialogDescription>Create a new task in this inbox.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium text-neutral2">
              Type <span className="text-red-400">*</span>
            </label>
            <input
              id="type"
              type="text"
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg bg-surface2 border border-border1 p-3 text-sm text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1"
              placeholder="e.g., support-request, analysis, review"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-neutral2">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg bg-surface2 border border-border1 p-3 text-sm text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1"
              placeholder="e.g., Analyze Q4 Report"
            />
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

          <div className="space-y-2">
            <label htmlFor="payload" className="text-sm font-medium text-neutral2">
              Payload (JSON)
            </label>
            <textarea
              id="payload"
              value={payloadText}
              onChange={e => setPayloadText(e.target.value)}
              className="w-full h-32 rounded-lg bg-surface2 border border-border1 p-3 text-sm font-mono text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1 resize-none"
              placeholder='{"message": "Help me with..."}'
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircleIcon className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
