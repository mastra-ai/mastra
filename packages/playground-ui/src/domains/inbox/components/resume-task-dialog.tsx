import { useState } from 'react';
import type { Task } from '@mastra/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { PlayIcon, AlertCircleIcon } from 'lucide-react';

export interface ResumeTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onResume: (taskId: string, payload: unknown) => void;
  isLoading?: boolean;
}

export function ResumeTaskDialog({ task, isOpen, onClose, onResume, isLoading }: ResumeTaskDialogProps) {
  const [payloadText, setPayloadText] = useState('{}');
  const [error, setError] = useState<string | null>(null);

  const handleResume = () => {
    if (!task) return;

    try {
      const payload = JSON.parse(payloadText);
      setError(null);
      onResume(task.id, payload);
    } catch {
      setError('Invalid JSON. Please enter valid JSON for the payload.');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPayloadText('{}');
      setError(null);
      onClose();
    }
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayIcon className="h-5 w-5" />
            Resume Task
          </DialogTitle>
          <DialogDescription>Provide the response payload to resume this suspended task.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {task.suspendPayload !== undefined && task.suspendPayload !== null && (
            <div className="rounded-lg bg-surface2 p-4">
              <h4 className="text-sm font-medium text-neutral2 mb-2">Suspend Payload (Input Requested)</h4>
              <pre className="text-xs text-neutral3 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(task.suspendPayload, null, 2)}
              </pre>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="payload" className="text-sm font-medium text-neutral2">
              Resume Payload (JSON)
            </label>
            <textarea
              id="payload"
              value={payloadText}
              onChange={e => setPayloadText(e.target.value)}
              className="w-full h-32 rounded-lg bg-surface2 border border-border1 p-3 text-sm font-mono text-neutral1 focus:outline-none focus:ring-2 focus:ring-accent1 resize-none"
              placeholder='{"response": "your response here"}'
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
            <Button onClick={handleResume} disabled={isLoading}>
              {isLoading ? 'Resuming...' : 'Resume Task'}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
