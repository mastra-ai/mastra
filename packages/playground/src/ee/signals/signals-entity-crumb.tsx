import { Combobox } from '@mastra/playground-ui/components/Combobox';

import { useSelectedThemeEntity } from './use-selected-theme-entity';

/** Breadcrumb agent selector for the Intelligence page, mirroring AgentCrumb. */
export function SignalsEntityCrumb() {
  const { entitiesQuery, entities, entity, selectEntity } = useSelectedThemeEntity();

  if (entitiesQuery.isPending || entitiesQuery.isError || !entity) return null;

  return (
    <Combobox
      options={entities.map(candidate => ({ label: candidate.entityId, value: candidate.entityId }))}
      value={entity.entityId}
      onValueChange={selectEntity}
      searchPlaceholder="Search agents..."
      emptyText="No agents found."
      variant="ghost"
      size="sm"
    />
  );
}
