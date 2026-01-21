import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useCreateDatasetRun } from '../hooks/use-dataset-runs';
import { useLinkComponent } from '@/lib/framework';

export type RunDatasetDialogProps = {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RunDatasetDialog({ datasetId, open, onOpenChange }: RunDatasetDialogProps) {
  const { navigate, paths } = useLinkComponent();
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { mutateAsync: createRun, isPending } = useCreateDatasetRun(datasetId);

  const agentList = agents ? Object.entries(agents).map(([id, agent]) => ({ id, name: agent.name })) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agentId) {
      setError('Please select an agent');
      return;
    }

    try {
      const result = await createRun({
        agentId,
        name: name.trim() || undefined,
      });
      onOpenChange(false);
      setAgentId('');
      setName('');
      // Navigate to the run detail page
      navigate(paths.datasetRunLink(datasetId, result.run.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Dataset</DialogTitle>
          <DialogDescription>Select an agent to run against all items in this dataset.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="run-agent">Agent</Label>
              <select
                id="run-agent"
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                disabled={agentsLoading}
                className="w-full px-3 py-2 text-sm bg-surface2 border border-border1 rounded-md focus:outline-none focus:ring-1 focus:ring-accent1"
              >
                <option value="">{agentsLoading ? 'Loading agents...' : 'Select an agent'}</option>
                {agentList.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-name">Run Name (optional)</Label>
              <input
                id="run-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Baseline run"
                className="w-full px-3 py-2 text-sm bg-surface2 border border-border1 rounded-md focus:outline-none focus:ring-1 focus:ring-accent1"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !agentId}>
                {isPending ? 'Starting...' : 'Start Run'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
