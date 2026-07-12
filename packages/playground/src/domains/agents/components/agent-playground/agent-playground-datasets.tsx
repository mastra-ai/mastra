import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Plus, Sparkles, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';

import { useAgentExperiments } from '../../hooks/use-agent-experiments';
import type { AgentExperiment } from '../../hooks/use-agent-experiments';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { GenerateItemsDialog } from '@/domains/datasets/components/generate-items-dialog';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';

interface AgentPlaygroundDatasetsProps {
  agentId: string;
}

export function AgentPlaygroundDatasets({ agentId }: AgentPlaygroundDatasetsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [generateDatasetId, setGenerateDatasetId] = useState<string | null>(null);

  const { data: datasetsData, isLoading: isDatasetsLoading } = useDatasets();
  const { data: experiments } = useAgentExperiments(agentId);
  const datasets = datasetsData?.datasets ?? [];

  // Build a map of dataset ID → latest experiment for this agent
  const latestExperimentByDataset = useMemo(() => {
    const map = new Map<string, AgentExperiment>();
    if (!experiments) return map;
    for (const exp of experiments) {
      if (!map.has(exp.datasetId)) {
        map.set(exp.datasetId, exp);
      }
    }
    return map;
  }, [experiments]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border1 px-4 py-3">
        <Txt variant="ui-sm" className="text-neutral3">
          Manage test datasets for this agent. Create datasets, generate seed data, and run experiments.
        </Txt>
        <Button variant="primary" size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1 size-3.5" />
          Create
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {isDatasetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-neutral3" />
            </div>
          ) : datasets.length === 0 ? (
            <div className="space-y-3 py-12 text-center">
              <Icon size="lg" className="mx-auto text-neutral3">
                <Database />
              </Icon>
              <div>
                <Txt variant="ui-sm" className="text-neutral3">
                  No datasets yet
                </Txt>
                <Txt variant="ui-xs" className="mt-1 text-neutral3">
                  Create a dataset to start testing your agent with structured test cases.
                </Txt>
              </div>
            </div>
          ) : (
            datasets.map(dataset => {
              const latestExp = latestExperimentByDataset.get(dataset.id);
              return (
                <DatasetCard
                  key={dataset.id}
                  name={dataset.name}
                  description={dataset.description}
                  version={dataset.version}
                  latestExperiment={latestExp}
                  onGenerate={() => setGenerateDatasetId(dataset.id)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>

      <CreateDatasetDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {generateDatasetId && (
        <GenerateItemsDialog datasetId={generateDatasetId} onDismiss={() => setGenerateDatasetId(null)} />
      )}
    </div>
  );
}

function DatasetCard({
  name,
  description,
  version,
  latestExperiment,
  onGenerate,
}: {
  name: string;
  description?: string | null;
  version: number;
  latestExperiment?: {
    status: string;
    succeededCount: number;
    failedCount: number;
    totalItems: number;
  };
  onGenerate: () => void;
}) {
  const passRate = latestExperiment
    ? latestExperiment.totalItems > 0
      ? Math.round((latestExperiment.succeededCount / latestExperiment.totalItems) * 100)
      : 0
    : null;

  return (
    <div className="rounded-lg border border-border1 p-3 transition-colors hover:bg-surface2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Txt variant="ui-sm" className="truncate font-medium text-neutral5">
              {name}
            </Txt>
            <Txt variant="ui-xs" className="text-neutral3">
              v{version}
            </Txt>
          </div>
          {description && (
            <Txt variant="ui-xs" className="mt-0.5 line-clamp-1 text-neutral3">
              {description}
            </Txt>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {latestExperiment && <ExperimentBadge status={latestExperiment.status} passRate={passRate} />}
          <Button variant="ghost" size="sm" onClick={onGenerate} title="Generate test data with AI">
            <Sparkles className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExperimentBadge({ status, passRate }: { status: string; passRate: number | null }) {
  if (status === 'running' || status === 'pending') {
    return (
      <div className="flex items-center gap-1 text-blue-400">
        <Loader2 className="size-3 animate-spin" />
        <Txt variant="ui-xs" className="text-blue-400">
          Running
        </Txt>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-1 text-red-400">
        <XCircle className="size-3" />
        <Txt variant="ui-xs" className="text-red-400">
          Failed
        </Txt>
      </div>
    );
  }

  if (passRate === null) return null;

  const color = passRate >= 80 ? 'text-green-500' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400';
  const StatusIcon = passRate >= 80 ? CheckCircle2 : XCircle;

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <StatusIcon className="size-3" />
      <Txt variant="ui-xs" className={color}>
        {passRate}%
      </Txt>
    </div>
  );
}
