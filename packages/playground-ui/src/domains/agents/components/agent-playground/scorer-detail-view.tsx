import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt';
import { Switch } from '@/ds/components/Switch';
import { Pencil } from 'lucide-react';
import type { GetScorerResponse } from '@mastra/client-js';

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
              {linkedDatasets.map(ds => (
                <button
                  key={ds.id}
                  onClick={() => onViewDataset?.(ds.id)}
                  className="w-full text-left px-3 py-2 rounded-md bg-surface3 hover:bg-surface4 transition-colors"
                >
                  <Txt variant="ui-xs" className="text-neutral5">
                    {ds.name}
                  </Txt>
                </button>
              ))}
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
