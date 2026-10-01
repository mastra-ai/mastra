import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsFieldsetRow, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { IntakeConfig, IntakeSourceBinding } from '../../factory/services/intake';
import type { JiraProject } from '../../factory/services/jira';
import type { FactoryProject } from '../../workspaces/services/github';

const NO_REPOSITORY_MAPPING = '__no_repository_mapping__';

/**
 * Jira project → repository routing. A project routed to a Factory with
 * linked repositories gets a default repository, plus component → repository
 * overrides for teams whose one board spans several repositories. Cards
 * carrying a routed component start there; the rest use the project default;
 * an unmapped project still asks for a repository when the Factory has more
 * than one.
 */
export function JiraRepositoryRouting({
  config,
  busy,
  update,
  sourceIds,
  projects,
  factories,
  bindings,
}: {
  config: IntakeConfig;
  busy: boolean;
  update: (next: IntakeConfig) => void;
  sourceIds: string[];
  projects: JiraProject[];
  factories: FactoryProject[];
  bindings: IntakeSourceBinding[];
}) {
  const routedProjects = sourceIds.flatMap(sourceId => {
    const binding = bindings.find(
      candidate => candidate.integrationId === 'jira' && candidate.sourceId === sourceId && candidate.factoryProjectId,
    );
    const factory = binding ? factories.find(candidate => candidate.id === binding.factoryProjectId) : undefined;
    const repositorySlugs = [...new Set(factory?.repositories.map(repository => repository.slug) ?? [])];
    if (repositorySlugs.length === 0) return [];
    const project = projects.find(candidate => candidate.id === sourceId);
    const name = project ? `${project.key} · ${project.name}` : sourceId;
    return [{ sourceId, name, repositorySlugs }];
  });

  if (routedProjects.length === 0) return null;

  const setProjectRepository = (sourceId: string, slug: string | null) => {
    const repositoryByJiraProject = { ...config.jira.repositoryByJiraProject };
    if (slug === null) delete repositoryByJiraProject[sourceId];
    else repositoryByJiraProject[sourceId] = slug;
    update({ ...config, jira: { ...config.jira, repositoryByJiraProject } });
  };

  const setComponentRepository = (sourceId: string, component: string, slug: string | null) => {
    const repositoryByJiraComponent = { ...config.jira.repositoryByJiraComponent };
    const routes = { ...repositoryByJiraComponent[sourceId] };
    if (slug === null) delete routes[component];
    else routes[component] = slug;
    if (Object.keys(routes).length === 0) delete repositoryByJiraComponent[sourceId];
    else repositoryByJiraComponent[sourceId] = routes;
    update({ ...config, jira: { ...config.jira, repositoryByJiraComponent } });
  };

  return (
    <div className="flex flex-col">
      <Txt as="p" variant="caption" className="text-muted-foreground px-4 py-2">
        Map Jira projects to repositories so their issues start in the intended repository. A component route wins over
        the project default.
      </Txt>
      {routedProjects.map(({ sourceId, name, repositorySlugs }) => (
        <ProjectRepositoryRows
          key={sourceId}
          name={name}
          repositorySlugs={repositorySlugs}
          busy={busy}
          defaultRepository={config.jira.repositoryByJiraProject?.[sourceId]}
          componentRoutes={config.jira.repositoryByJiraComponent?.[sourceId] ?? {}}
          onDefaultChange={slug => setProjectRepository(sourceId, slug)}
          onComponentChange={(component, slug) => setComponentRepository(sourceId, component, slug)}
        />
      ))}
    </div>
  );
}

function ProjectRepositoryRows({
  name,
  repositorySlugs,
  busy,
  defaultRepository,
  componentRoutes,
  onDefaultChange,
  onComponentChange,
}: {
  name: string;
  repositorySlugs: string[];
  busy: boolean;
  defaultRepository: string | undefined;
  componentRoutes: Record<string, string>;
  onDefaultChange: (slug: string | null) => void;
  onComponentChange: (component: string, slug: string | null) => void;
}) {
  const [draft, setDraft] = useState('');
  const [draftRepository, setDraftRepository] = useState<string | null>(null);
  const trimmed = draft.trim();
  const duplicate = Object.keys(componentRoutes).some(
    component => component.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  const routes = Object.entries(componentRoutes).toSorted(([left], [right]) => left.localeCompare(right));

  return (
    <div role="group" aria-label={`Repositories for ${name}`} className="flex flex-col">
      <SettingsRow label={name}>
        <RepositorySelect
          ariaLabel={`Repository for ${name}`}
          value={defaultRepository ?? null}
          placeholder="No repository mapping"
          repositorySlugs={repositorySlugs}
          disabled={busy}
          onChange={onDefaultChange}
        />
      </SettingsRow>
      {routes.map(([component, slug]) => (
        <SettingsRow
          key={component}
          label={component}
          description={
            repositorySlugs.includes(slug) ? undefined : `Repository ${slug} is no longer linked to this Factory.`
          }
        >
          <div className="flex items-center gap-2">
            <RepositorySelect
              ariaLabel={`Repository for ${name} component ${component}`}
              value={slug}
              placeholder={slug}
              repositorySlugs={repositorySlugs}
              disabled={busy}
              onChange={next => onComponentChange(component, next)}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove route for ${name} component ${component}`}
              disabled={busy}
              onClick={() => onComponentChange(component, null)}
            >
              Remove
            </Button>
          </div>
        </SettingsRow>
      ))}
      <SettingsFieldsetRow
        label="Add component route"
        description={duplicate ? 'That component is already routed — change its repository above.' : undefined}
      >
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            aria-label={`Component for ${name}`}
            placeholder="component"
            value={draft}
            disabled={busy}
            onChange={event => setDraft(event.target.value)}
          />
          <RepositorySelect
            ariaLabel={`Repository for new ${name} component`}
            value={draftRepository}
            placeholder="Choose a repository"
            repositorySlugs={repositorySlugs}
            disabled={busy}
            onChange={setDraftRepository}
          />
          <Button
            size="sm"
            disabled={busy || !trimmed || !draftRepository || duplicate}
            onClick={() => {
              if (!draftRepository) return;
              onComponentChange(trimmed, draftRepository);
              setDraft('');
              setDraftRepository(null);
            }}
          >
            Add
          </Button>
        </div>
      </SettingsFieldsetRow>
    </div>
  );
}

function RepositorySelect({
  ariaLabel,
  value,
  placeholder,
  repositorySlugs,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: string | null;
  placeholder: string;
  repositorySlugs: string[];
  disabled: boolean;
  onChange: (slug: string | null) => void;
}) {
  const current = value && repositorySlugs.includes(value) ? value : null;
  return (
    <Select
      value={current ?? NO_REPOSITORY_MAPPING}
      disabled={disabled}
      onValueChange={next => onChange(next === NO_REPOSITORY_MAPPING ? null : next)}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel} className="w-auto">
        <Txt as="span" variant="caption">
          {current ?? placeholder}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_REPOSITORY_MAPPING}>No repository mapping</SelectItem>
        {repositorySlugs.map(slug => (
          <SelectItem key={slug} value={slug}>
            {slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
