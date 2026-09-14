import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { ArrowRight } from 'lucide-react';

import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import { isLinearReauthError } from '../../../factory/services/linear';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { CreateFactoryPaletteAlert, CreateFactoryPaletteMessage } from './CreateFactoryPalette';

export interface CreateFactoryLinearRowsProps {
  query: string;
  onConnect: () => void;
  onSelectProject: (projectId: string) => void;
  onSkip: () => void;
}

export function CreateFactoryLinearRows({ query, onConnect, onSelectProject, onSkip }: CreateFactoryLinearRowsProps) {
  const linearStatus = useLinearStatusQuery();
  const status = linearStatus.data;
  const connected = status?.connected === true;
  const projects = useLinearProjectsQuery(connected);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (title: string) => title.toLowerCase().includes(normalizedQuery);

  const skipRow = matches('Skip for now') && (
    <CommandPaletteItem
      icon={<ArrowRight />}
      title="Skip for now"
      subtitle="This Factory takes its work from GitHub only"
      value="skip-linear"
      onSelect={onSkip}
    />
  );

  if (linearStatus.isPending || (connected && projects.isPending)) {
    return <SkeletonRows label="Loading Linear projects" rows={2} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }

  if (!connected) {
    const connectable = status?.reason !== 'missing_config' && status?.reason !== 'organization_required';
    const connectTitle = status?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear';
    return (
      <CommandGroup heading="Linear">
        {skipRow}
        {connectable ? (
          matches(connectTitle) && (
            <CommandPaletteItem
              icon={<LinearIcon />}
              title={connectTitle}
              subtitle="Import issues and priorities into the Factory board"
              value="connect-linear"
              onSelect={onConnect}
            />
          )
        ) : (
          <CreateFactoryPaletteMessage>Linear is not configured for this deployment.</CreateFactoryPaletteMessage>
        )}
      </CommandGroup>
    );
  }

  if (projects.isError) {
    return (
      <CommandGroup heading="Linear">
        {skipRow}
        {isLinearReauthError(projects.error) ? (
          <CommandPaletteItem
            icon={<LinearIcon />}
            title="Reconnect Linear"
            subtitle="Its authorization expired, so its projects cannot be read"
            value="connect-linear"
            onSelect={onConnect}
          />
        ) : (
          <CreateFactoryPaletteAlert>{projects.error.message}</CreateFactoryPaletteAlert>
        )}
      </CommandGroup>
    );
  }

  const allProjects = projects.data ?? [];
  const matchingProjects = allProjects.filter(project => matches(project.name));

  return (
    <CommandGroup heading={`Projects in ${status.workspace?.name ?? 'Linear'}`}>
      {skipRow}
      {matchingProjects.map(project => (
        <CommandPaletteItem
          key={project.id}
          icon={<LinearIcon />}
          title={project.name}
          subtitle={project.teams.map(team => team.name).join(', ') || 'Its issues feed this Factory board'}
          shortcut={<Kbd size="sm">↵</Kbd>}
          value={`linear-${project.id}`}
          onSelect={() => onSelectProject(project.id)}
        />
      ))}
      {matchingProjects.length === 0 && (
        <CreateFactoryPaletteMessage>
          {allProjects.length > 0 ? 'No Linear project matches this search.' : 'This workspace has no projects yet.'}
        </CreateFactoryPaletteMessage>
      )}
    </CommandGroup>
  );
}
