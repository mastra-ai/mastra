import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

import type { LinearProject } from '../../factory/services/linear';
import { SourcePicker } from './IntakeSourcePicker';
import type { SourcePickerItem } from './IntakeSourcePicker';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';

export interface MappableLinearProject {
  project: LinearProject;
  repositorySlugs: string[];
}

export function LinearRepositoryMappings({
  projects,
  mapping,
  saving,
  onSetRepository,
}: {
  projects: MappableLinearProject[];
  mapping: Record<string, string> | undefined;
  saving: boolean;
  onSetRepository: (projectId: string, slug: string | null) => void;
}) {
  const slugsByProject = new Map(projects.map(({ project, repositorySlugs }) => [project.id, repositorySlugs]));
  const repositorySelect = (item: SourcePickerItem, afterChange?: () => void) => (
    <RepositorySelect
      projectName={item.label}
      value={mapping?.[item.id]}
      slugs={slugsByProject.get(item.id) ?? []}
      onChange={slug => {
        onSetRepository(item.id, slug);
        afterChange?.();
      }}
    />
  );

  return (
    <>
      <SettingsRow
        label="Repository mapping"
        description="Issues from a mapped Linear project start in its repository."
      />
      <SourcePicker
        label="Linear repository mappings"
        addLabel="Add repository mapping"
        itemIcon={<SettingsIntegrationIcon provider="linear" />}
        groups={[
          {
            id: 'linear-projects',
            items: projects.map(({ project }) => ({
              id: project.id,
              label: project.name,
              hint: project.teams.map(team => team.name).join(', ') || undefined,
            })),
          },
        ]}
        selectedIds={projects.filter(({ project }) => mapping?.[project.id]).map(({ project }) => project.id)}
        saving={saving}
        onToggleItem={id => onSetRepository(id, null)}
        itemActions={item => repositorySelect(item)}
        pickControl={(item, focusSearch) => repositorySelect(item, () => requestAnimationFrame(focusSearch))}
      />
    </>
  );
}

function RepositorySelect({
  projectName,
  value,
  slugs,
  onChange,
}: {
  projectName: string;
  value: string | undefined;
  slugs: string[];
  onChange: (slug: string) => void;
}) {
  return (
    <Select value={value ?? null} onValueChange={slug => slug && onChange(slug)}>
      <SelectTrigger size="sm" aria-label={`Repository for ${projectName}`} className="w-auto max-w-full min-w-0">
        <Txt as="span" variant="caption">
          {value ?? 'Choose repository'}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        {slugs.map(slug => (
          <SelectItem key={slug} value={slug}>
            {slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
