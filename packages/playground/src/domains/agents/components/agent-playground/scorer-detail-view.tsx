import type { GetScorerResponse } from '@mastra/client-js';
import { Badge, Button, Chip, Switch, Txt, Icon } from '@mastra/playground-ui';
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
      <div className="flex items-center justify-center h-full">
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Txt variant="ui-sm" className="text-neutral5 font-medium truncate">
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
              <Txt variant="ui-xs" className="text-neutral3 block mt-1">
                {description}
              </Txt>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
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
        <div className="flex items-center justify-between py-2 px-3 bg-surface3 rounded-md">
          <div>
            <Txt variant="ui-xs" className="text-neutral5 block">
              Run in experiments
            </Txt>
            <Txt variant="ui-xs" className="text-neutral3 block mt-0.5">
              When enabled, this scorer grades results for this agent
            </Txt>
          </div>
          <Switch checked={isAttached} onCheckedChange={onToggleAttach} />
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <Txt variant="ui-xs" className="text-neutral3 font-medium uppercase tracking-wider block mb-2">
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
            <Txt variant="ui-xs" className="text-neutral3 font-medium uppercase tracking-wider block mb-2">
              Datasets
            </Txt>
            <div className="space-y-1">
              {linkedDatasets.map(ds =>
                onViewDataset ? (
                  <button
                    key={ds.id}
                    onClick={() => onViewDataset(ds.id)}
                    className="w-full text-left px-3 py-2 rounded-md bg-surface3 hover:bg-surface4 transition-colors cursor-pointer"
                  >
                    <Txt variant="ui-xs" className="text-neutral5">
                      {ds.name}
                    </Txt>
                  </button>
                ) : (
                  <div key={ds.id} className="px-3 py-2 rounded-md bg-surface3">
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
          <div className="p-3 bg-surface3 rounded-md">
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
      <Txt variant="ui-xs" className="text-neutral3 w-24 shrink-0">
        {label}
      </Txt>
      <Txt variant="ui-xs" className="text-neutral5 break-all">
        {value}
      </Txt>
    </div>
  );
}
