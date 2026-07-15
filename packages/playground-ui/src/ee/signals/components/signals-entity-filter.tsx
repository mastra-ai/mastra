import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ds/components/Select';
import type { EntityLearningEntitySummary } from '../services';
import type { SelectedEntity } from '../types';

export interface SignalsEntityFilterProps {
  entities: EntityLearningEntitySummary[];
  selected: SelectedEntity | null;
  onChange: (selected: SelectedEntity | null) => void;
}

const AGENT_ENTITY_TYPE = 'agent';

/**
 * Agent picker mirroring the traces filter intent. Tool and workflow entities
 * are not supported yet, so the page is scoped to the `agent` entities reported
 * by the `/entity-learning/entities` response.
 */
export function SignalsEntityFilter({ entities, selected, onChange }: SignalsEntityFilterProps) {
  const agents = useMemo(() => entities.filter(entity => entity.entityType === AGENT_ENTITY_TYPE), [entities]);

  const handleAgentChange = (entityId: string) => {
    const agent = agents.find(item => item.entityId === entityId);
    if (!agent) return;
    onChange({ entityType: agent.entityType, entityId: agent.entityId });
  };

  return (
    <div className="flex flex-wrap items-center gap-3" role="search" aria-label="Filter signals by agent">
      <label className="flex items-center gap-2">
        <span className="font-mono text-xs whitespace-nowrap text-neutral3 uppercase">Agent</span>
        <Select value={selected?.entityId ?? ''} onValueChange={handleAgentChange} disabled={agents.length === 0}>
          <SelectTrigger size="sm" variant="outline" className="min-w-64" aria-label="Agent">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map(agent => (
              <SelectItem key={agent.entityId} value={agent.entityId}>
                {agent.entityId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
