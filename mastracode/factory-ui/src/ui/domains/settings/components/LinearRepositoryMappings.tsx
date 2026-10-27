import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

import type { LinearProject } from '../../factory/services/linear';
import { SourcePicker } from './IntakeSourcePicker';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';

export interface MappableLinearProject {
  project: LinearProject;
  repositorySlugs: string[];
}

export function LinearRepositoryMappings({
  projects,
  mapping,
  pending,
  onChange,
}: {
  projects: MappableLinearProject[];
  mapping: Record<string, string> | undefined;
  pending: boolean;
  onChange: (mapping: Record<string, string>) => Promise<void>;
}) {
  const slugsByProject = new Map(projects.map(({ project, repositorySlugs }) => [project.id, repositorySlugs]));
  const setRepository = (projectId: string, slug: string | null) => {
    const next = { ...mapping };
    if (slug) next[projectId] = slug;
    else delete next[projectId];
    return onChange(next);
  };

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
        pending={pending}
        onToggleItem={id => setRepository(id, null)}
        itemActions={item => (
          <RepositorySelect
            projectName={item.label}
            value={mapping?.[item.id]}
            slugs={slugsByProject.get(item.id) ?? []}
            disabled={pending}
            onChange={slug => void setRepository(item.id, slug)}
          />
        )}
        addControl={(item, focusSearch) => (
          <RepositorySelect
            projectName={item.label}
            value={undefined}
            slugs={slugsByProject.get(item.id) ?? []}
            disabled={pending}
            onChange={async slug => {
              await setRepository(item.id, slug);
              requestAnimationFrame(focusSearch);
            }}
          />
        )}
      />
    </>
  );
}

function RepositorySelect({
  projectName,
  value,
  slugs,
  disabled,
  onChange,
}: {
  projectName: string;
  value: string | undefined;
  slugs: string[];
  disabled: boolean;
  onChange: (slug: string) => void;
}) {
  return (
    <Select value={value ?? null} disabled={disabled} onValueChange={slug => slug && onChange(slug)}>
      <SelectTrigger size="sm" aria-label={`Repository for ${projectName}`} className="w-auto">
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
