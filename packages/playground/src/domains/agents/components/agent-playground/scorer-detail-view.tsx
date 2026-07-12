import type { GetScorerResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Pencil } from 'lucide-react';

interface LinkedDataset {
  id: string;
  name: string;
}

interface ScorerDetailViewProps {
  scorerId: string;
  scorerData?: GetScorerResponse;
  isAttached: boolean;
  onToggleAttach: () => void;
  onEdit: () => void;
  linkedDatasets?: LinkedDataset[];
  onViewDataset?: (datasetId: string) => void;
}

export function ScorerDetailView({
  scorerId,
  scorerData,
  isAttached,
  onToggleAttach,
  onEdit,
  linkedDatasets,
  onViewDataset,
}: ScorerDetailViewProps) {
  if (!scorerData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Txt variant="ui-sm" className="text-neutral3">
          Scorer not found
        </Txt>
      </div>
    );
  }

  const name = scorerData.scorer?.name || scorerId;
  const description = scorerData.scorer?.description;
  const isCode = scorerData.source === 'code';
  const isTrajectory = scorerData.scorer?.config?.type === 'trajectory';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="space-y-3 border-b border-border1 p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Txt variant="ui-sm" className="truncate font-medium text-neutral5">
                {name}
              </Txt>
              {isTrajectory && (
                <Chip size="small" color="purple">
                  trajectory
                </Chip>
              )}
              {isCode && (
                <span title="Defined in code — cannot be edited in the UI">
                  <Badge variant="default">Code</Badge>
                </span>
              )}
            </div>
            {description && (
              <Txt variant="ui-xs" className="mt-1 block text-neutral3">
                {description}
              </Txt>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!isCode && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Icon size="sm">
                  <Pencil />
                </Icon>
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Attach toggle */}
        <div className="flex items-center justify-between rounded-md bg-surface3 px-3 py-2">
          <div>
            <Txt variant="ui-xs" className="block text-neutral5">
              Run in experiments
            </Txt>
            <Txt variant="ui-xs" className="mt-0.5 block text-neutral3">
              When enabled, this scorer grades results for this agent
            </Txt>
          </div>
          <Switch checked={isAttached} onCheckedChange={onToggleAttach} />
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <Txt variant="ui-xs" className="mb-2 block font-medium tracking-wider text-neutral3 uppercase">
            Details
          </Txt>
          <div className="space-y-2">
            <DetailRow label="ID" value={scorerId} />
            <DetailRow label="Type" value={isTrajectory ? 'Trajectory' : 'Agent'} />
            <DetailRow label="Source" value={isCode ? 'Code' : 'Stored'} />
            {scorerData.agentIds && scorerData.agentIds.length > 0 && (
              <DetailRow
                label="Used by agents"
                value={scorerData.agentNames?.join(', ') || scorerData.agentIds.join(', ')}
              />
            )}
          </div>
        </div>

        {linkedDatasets && linkedDatasets.length > 0 && (
          <div>
            <Txt variant="ui-xs" className="mb-2 block font-medium tracking-wider text-neutral3 uppercase">
              Datasets
            </Txt>
            <div className="space-y-1">
              {linkedDatasets.map(ds =>
                onViewDataset ? (
                  <button
                    key={ds.id}
                    onClick={() => onViewDataset(ds.id)}
                    className="w-full cursor-pointer rounded-md bg-surface3 px-3 py-2 text-left transition-colors hover:bg-surface4"
                  >
                    <Txt variant="ui-xs" className="text-neutral5">
                      {ds.name}
                    </Txt>
                  </button>
                ) : (
                  <div key={ds.id} className="rounded-md bg-surface3 px-3 py-2">
                    <Txt variant="ui-xs" className="text-neutral5">
                      {ds.name}
                    </Txt>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {isCode && (
          <div className="rounded-md bg-surface3 p-3">
            <Txt variant="ui-xs" className="text-neutral3">
              This scorer is defined in code and cannot be edited in the UI. You can toggle whether it runs in
              experiments for this agent.
            </Txt>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Txt variant="ui-xs" className="w-24 shrink-0 text-neutral3">
        {label}
      </Txt>
      <Txt variant="ui-xs" className="break-all text-neutral5">
        {value}
      </Txt>
    </div>
  );
}
