import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ds/components/Select';
import { useEntities } from '../hooks';
import type { EntityLearningEntitySummary } from '../services';
import type { SelectedEntity } from '../types';

export interface SignalsEntityFilterProps {
  entities: EntityLearningEntitySummary[];
  selected: SelectedEntity | null;
  onChange: (selected: SelectedEntity | null) => void;
}

const ALL_TYPES = '__all__';

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * Two-step entity picker (entity type → entity) mirroring the traces filter
 * intent. Lets the user scope the Signals page to any entity reported by the
 * server. Driven by the `/entity-learning/entities` response.
 */
export function SignalsEntityFilter({ entities, selected, onChange }: SignalsEntityFilterProps) {
  const entityTypes = useMemo(() => Array.from(new Set(entities.map(entity => entity.entityType))).sort(), [entities]);

  const selectedType = selected?.entityType ?? ALL_TYPES;

  const entitiesForType = useMemo(() => {
    if (selectedType === ALL_TYPES) return [];
    return entities.filter(entity => entity.entityType === selectedType);
  }, [entities, selectedType]);

  const handleTypeChange = (entityType: string) => {
    if (entityType === ALL_TYPES) {
      onChange(null);
      return;
    }
    const first = entities.find(entity => entity.entityType === entityType);
    onChange(first ? { entityType, entityId: first.entityId } : null);
  };

  const handleEntityChange = (entityId: string) => {
    const entity = entities.find(item => item.entityId === entityId);
    if (!entity) return;
    onChange({ entityType: entity.entityType, entityId: entity.entityId });
  };

  return (
    <div className="flex flex-wrap items-center gap-3" role="search" aria-label="Filter signals by entity">
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap font-mono text-xs uppercase text-neutral3">Entity type</span>
        <Select value={selectedType} onValueChange={handleTypeChange}>
          <SelectTrigger size="sm" variant="outline" className="min-w-40" aria-label="Entity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            {entityTypes.map(entityType => (
              <SelectItem key={entityType} value={entityType}>
                {capitalize(entityType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap font-mono text-xs uppercase text-neutral3">Entity</span>
        <Select
          value={selected?.entityId ?? ''}
          onValueChange={handleEntityChange}
          disabled={entitiesForType.length === 0}
        >
          <SelectTrigger size="sm" variant="outline" className="min-w-64" aria-label="Entity">
            <SelectValue placeholder="Select an entity" />
          </SelectTrigger>
          <SelectContent>
            {entitiesForType.map(entity => (
              <SelectItem key={entity.entityId} value={entity.entityId}>
                {entity.entityId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

/** Convenience wrapper that loads entities itself. Used where parents don't fetch. */
export function SignalsEntityFilterContainer({ selected, onChange }: Omit<SignalsEntityFilterProps, 'entities'>) {
  const { data: entities = [] } = useEntities();
  return <SignalsEntityFilter entities={entities} selected={selected} onChange={onChange} />;
}
