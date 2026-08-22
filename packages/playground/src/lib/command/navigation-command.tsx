import { CommandEmpty, CommandGroup } from '@mastra/playground-ui/components/Command';
import {
  CommandPaletteBody,
  CommandPaletteDialog,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteRail,
  CommandPaletteResults,
  CommandPaletteScope,
} from '@mastra/playground-ui/components/CommandPalette';
import { useMaybeSidebarState } from '@mastra/playground-ui/components/MainSidebar';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import {
  Cpu,
  EyeIcon,
  GaugeIcon,
  Layers3Icon,
  PackageIcon,
  PanelLeftIcon,
  RouteIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import React from 'react';

import { useNavigationCommand } from './use-navigation-command';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getPermissionForRoute, hasRoutePermission } from '@/domains/auth/route-permissions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';
import { useMastraPlatform } from '@/lib/mastra-platform';
import { bottomNav, mainNav } from '@/lib/nav/nav-items';
import type { NavItem } from '@/lib/nav/nav-items';

type CommandScope = 'all' | 'paths' | 'agents' | 'workflows' | 'tooling' | 'evaluation' | 'observability' | 'settings';

type ScopeOption = {
  id: CommandScope;
  label: string;
  icon: React.ReactNode;
  count: number;
};

function getRouteValue(item: NavItem, sectionTitle?: string) {
  return [item.name, item.url, sectionTitle, item.docs?.label, 'path route navigate'].filter(Boolean).join(' ');
}

function getRouteBadge(sectionTitle?: string) {
  if (!sectionTitle || sectionTitle === 'Studio') return 'Path';
  return sectionTitle;
}

function getTracesEntityPath(entity: string) {
  return `/traces?entity=${encodeURIComponent(entity)}`;
}

type NavigationSection = {
  key: string;
  title: string;
  items: NavItem[];
};

type NavigationPaths = ReturnType<typeof useLinkComponent>['paths'];
type SidebarContextValue = NonNullable<ReturnType<typeof useMaybeSidebarState>>;
type HandleSelect = (path: string) => void;
type AgentEntry = [string, { name: string }];
type WorkflowEntry = [string, { name: string }];
type ToolEntry = [string, { id: string }];
type ProcessorEntry = {
  id: string;
  name?: string;
  isWorkflow?: boolean;
};
type McpServerEntry = {
  id: string;
  name: string;
};
type ScorerEntry = [
  string,
  {
    scorer?: {
      config?: {
        id?: string;
        name?: string;
      };
    };
  },
];

const CommandRail = ({
  scopeOptions,
  activeScope,
  onScopeChange,
}: {
  scopeOptions: ScopeOption[];
  activeScope: CommandScope;
  onScopeChange: (scope: CommandScope) => void;
}) => (
  <CommandPaletteRail aria-label="Search categories">
    {scopeOptions.map(option => (
      <CommandPaletteScope
        key={option.id}
        icon={option.icon}
        label={option.label}
        count={option.count}
        active={activeScope === option.id}
        onSelect={() => onScopeChange(option.id)}
      />
    ))}
  </CommandPaletteRail>
);

const CommandResults = ({
  sidebar,
  activeScope,
  closeCommand,
}: {
  sidebar: SidebarContextValue | null;
  activeScope: CommandScope;
  closeCommand: () => void;
}) => {
  if (!sidebar || (activeScope !== 'all' && activeScope !== 'settings')) return null;

  return (
    <CommandGroup heading="Commands">
      <CommandPaletteItem
        value="toggle sidebar collapse expand layout panel"
        onSelect={() => {
          sidebar.toggleSidebar();
          closeCommand();
        }}
        icon={<PanelLeftIcon />}
        title="Toggle Sidebar"
        subtitle="Studio layout"
      />
    </CommandGroup>
  );
};

const PathSectionResults = ({
  sections,
  handleSelect,
}: {
  sections: NavigationSection[];
  handleSelect: HandleSelect;
}) => (
  <>
    {sections.map(section => (
      <CommandGroup key={section.key} heading={section.title}>
        {section.items.map(item => {
          const Icon = item.Icon;
          return (
            <CommandPaletteItem
              key={item.url}
              value={getRouteValue(item, section.title)}
              onSelect={() => handleSelect(item.url)}
              icon={<Icon />}
              title={item.name}
              subtitle="Studio path"
              path={item.url}
              badge={getRouteBadge(section.title)}
            />
          );
        })}
      </CommandGroup>
    ))}
  </>
);

const AgentResults = ({
  visible,
  entries,
  paths,
  handleSelect,
}: {
  visible: boolean;
  entries: AgentEntry[];
  paths: NavigationPaths;
  handleSelect: HandleSelect;
}) => {
  if (!visible || entries.length === 0) return null;

  return (
    <CommandGroup heading="Agents">
      {entries.map(([id, agent]) => (
        <CommandPaletteItem
          key={id}
          value={`${agent.name} ${id} chat agent conversation thread ${paths.agentLink(id)}`}
          onSelect={() => handleSelect(paths.agentLink(id))}
          icon={<AgentIcon />}
          title={agent.name}
          subtitle="Agent chat"
          path={paths.agentLink(id)}
          badge="Agent"
        />
      ))}
    </CommandGroup>
  );
};

const WorkflowResults = ({
  visible,
  entries,
  paths,
  handleSelect,
}: {
  visible: boolean;
  entries: WorkflowEntry[];
  paths: NavigationPaths;
  handleSelect: HandleSelect;
}) => {
  if (!visible || entries.length === 0) return null;

  return (
    <CommandGroup heading="Workflows">
      {entries.map(([id, workflow]) => (
        <CommandPaletteItem
          key={id}
          value={`${workflow.name} ${id} graph workflow view ${paths.workflowLink(id)}`}
          onSelect={() => handleSelect(paths.workflowLink(id))}
          icon={<WorkflowIcon />}
          title={workflow.name}
          subtitle="Workflow graph"
          path={paths.workflowLink(id)}
          badge="Workflow"
        />
      ))}
    </CommandGroup>
  );
};

const ToolResults = ({
  visible,
  entries,
  paths,
  handleSelect,
}: {
  visible: boolean;
  entries: ToolEntry[];
  paths: NavigationPaths;
  handleSelect: HandleSelect;
}) => {
  if (!visible || entries.length === 0) return null;

  return (
    <CommandGroup heading="Tools">
      {entries.map(([id, tool]) => (
        <CommandPaletteItem
          key={id}
          value={`tool ${tool.id} ${id} ${paths.toolLink(id)}`}
          onSelect={() => handleSelect(paths.toolLink(id))}
          icon={<ToolsIcon />}
          title={tool.id}
          subtitle="Tool definition"
          path={paths.toolLink(id)}
          badge="Tool"
        />
      ))}
    </CommandGroup>
  );
};

const ProcessorResults = ({
  visible,
  entries,
  paths,
  handleSelect,
}: {
  visible: boolean;
  entries: ProcessorEntry[];
  paths: NavigationPaths;
  handleSelect: HandleSelect;
}) => {
  if (!visible || entries.length === 0) return null;

  return (
    <CommandGroup heading="Processors">
      {entries.map(processor => {
        const displayName = processor.name || processor.id;
        const targetPath = processor.isWorkflow
          ? paths.workflowLink(processor.id) + '/graph'
          : paths.processorLink(processor.id);
        return (
          <CommandPaletteItem
            key={processor.id}
            value={`processor ${displayName} ${processor.id} ${targetPath}`}
            onSelect={() => handleSelect(targetPath)}
            icon={<Cpu />}
            title={displayName}
            subtitle={processor.isWorkflow ? 'Workflow processor' : 'Processor'}
            path={targetPath}
            badge="Processor"
          />
        );
      })}
    </CommandGroup>
  );
};

const McpServerResults = ({
  visible,
  entries,
  paths,
  handleSelect,
}: {
  visible: boolean;
  entries: McpServerEntry[];
  paths: NavigationPaths;
  handleSelect: HandleSelect;
}) => {
  if (!visible || entries.length === 0) return null;

  return (
    <CommandGroup heading="MCP Servers">
      {entries.map(server => (
        <CommandPaletteItem
          key={server.id}
          value={`mcp server ${server.name} ${server.id} ${paths.mcpServerLink(server.id)}`}
          onSelect={() => handleSelect(paths.mcpServerLink(server.id))}
          icon={<McpServerIcon />}
          title={server.name}
          subtitle="MCP server"
          path={paths.mcpServerLink(server.id)}
          badge="MCP"
        />
      ))}
    </CommandGroup>
  );
};

const ObservabilityResults = ({
  visible,
  agentEntries,
  workflowEntries,
  handleSelect,
}: {
  visible: boolean;
  agentEntries: AgentEntry[];
  workflowEntries: WorkflowEntry[];
  handleSelect: HandleSelect;
}) => {
  if (!visible) return null;

  return (
    <>
      <CommandGroup heading="Observability">
        <CommandPaletteItem
          value="observability traces telemetry signals /traces"
          onSelect={() => handleSelect('/traces')}
          icon={<EyeIcon />}
          title="Traces"
          subtitle="Runtime traces"
          path="/traces"
          badge="Signal"
        />
        <CommandPaletteItem
          value="metrics usage latency performance tokens /metrics"
          onSelect={() => handleSelect('/metrics')}
          icon={<GaugeIcon />}
          title="Metrics"
          subtitle="Runtime metrics"
          path="/metrics"
          badge="Signal"
        />
        <CommandPaletteItem
          value="feedback thumbs rating annotations /feedback"
          onSelect={() => handleSelect('/feedback')}
          icon={<EyeIcon />}
          title="Feedback"
          subtitle="User feedback"
          path="/feedback"
          badge="Signal"
        />
        <CommandPaletteItem
          value="logs events runtime /logs"
          onSelect={() => handleSelect('/logs')}
          icon={<EyeIcon />}
          title="Logs"
          subtitle="Runtime logs"
          path="/logs"
          badge="Signal"
        />
      </CommandGroup>

      {agentEntries.length > 0 && (
        <CommandGroup heading="Agent Traces">
          {agentEntries.map(([id, agent]) => {
            const path = getTracesEntityPath(id);

            return (
              <CommandPaletteItem
                key={id}
                value={`${agent.name} ${id} traces agent observability telemetry`}
                onSelect={() => handleSelect(path)}
                icon={<EyeIcon />}
                title={agent.name}
                subtitle="Agent traces"
                path={path}
                badge="Trace"
              />
            );
          })}
        </CommandGroup>
      )}

      {workflowEntries.length > 0 && (
        <CommandGroup heading="Workflow Traces">
          {workflowEntries.map(([id, workflow]) => {
            const path = getTracesEntityPath(workflow.name);

            return (
              <CommandPaletteItem
                key={id}
                value={`${workflow.name} ${id} traces workflow observability telemetry`}
                onSelect={() => handleSelect(path)}
                icon={<EyeIcon />}
                title={workflow.name}
                subtitle="Workflow traces"
                path={path}
                badge="Trace"
              />
            );
          })}
        </CommandGroup>
      )}
    </>
  );
};

const EvaluationResults = ({
  visible,
  entries,
  paths,
  handleSelect,
}: {
  visible: boolean;
  entries: ScorerEntry[];
  paths: NavigationPaths;
  handleSelect: HandleSelect;
}) => {
  if (!visible || entries.length === 0) return null;

  return (
    <CommandGroup heading="Scorers">
      {entries.map(([id, scorer]) => {
        const name = scorer.scorer?.config?.name || scorer.scorer?.config?.id || id;
        return (
          <CommandPaletteItem
            key={id}
            value={`scorer score evaluation ${name} ${id} ${paths.scorerLink(id)}`}
            onSelect={() => handleSelect(paths.scorerLink(id))}
            icon={<GaugeIcon />}
            title={name}
            subtitle="Evaluation scorer"
            path={paths.scorerLink(id)}
            badge="Scorer"
          />
        );
      })}
    </CommandGroup>
  );
};

export const NavigationCommand = () => {
  const { open, setOpen } = useNavigationCommand();
  const { navigate, paths } = useLinkComponent();
  const { isMastraPlatform } = useMastraPlatform();
  const sidebar = useMaybeSidebarState();
  const [activeScope, setActiveScope] = React.useState<CommandScope>('all');

  const { data: agents = {} } = useAgents();
  const { data: workflows = {} } = useWorkflows();
  const { data: tools = {} } = useTools();
  const { data: processors = {} } = useProcessors();
  const { data: mcpServers = [] } = useMCPServers();
  const { data: scorers = {} } = useScorers();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const { hasPermission, hasAnyPermission, isLoading: isPermissionsLoading } = usePermissions();

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setActiveScope('all');
  };

  const closeCommand = () => updateOpen(false);

  const handleSelect = (path: string) => {
    navigate(path);
    closeCommand();
  };

  const filterNavItem = React.useCallback(
    (item: NavItem) => {
      if (item.hidden) return false;
      if (item.url === '/prompts' && !isCmsAvailable && !isCmsLoading) return false;
      if (isMastraPlatform && !item.isOnMastraPlatform) return false;

      const requiredPermission = getPermissionForRoute(item.url);
      if (isPermissionsLoading && requiredPermission && requiredPermission !== 'public') return false;

      return hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission);
    },
    [hasAnyPermission, hasPermission, isCmsAvailable, isCmsLoading, isMastraPlatform, isPermissionsLoading],
  );

  const agentEntries = Object.entries(agents);
  const workflowEntries = Object.entries(workflows);
  const toolEntries = Object.entries(tools);
  const processorEntries = Object.values(processors).filter(p => p.phases && p.phases.length > 0);
  const scorerEntries = Object.entries(scorers);

  const navigationSections = React.useMemo(() => {
    const sections: NavigationSection[] = [];
    for (const section of mainNav) {
      const items = section.items.filter(filterNavItem);
      if (items.length > 0) sections.push({ key: section.key, title: section.title, items });
    }

    const studioItems: NavItem[] = [
      ...bottomNav.filter(filterNavItem),
      ...(!isMastraPlatform
        ? [
            {
              name: 'Templates',
              url: '/templates',
              Icon: PackageIcon,
              isOnMastraPlatform: false,
            },
          ]
        : []),
    ];

    if (studioItems.length === 0) return sections;
    return [...sections, { key: 'studio', title: 'Studio', items: studioItems }];
  }, [filterNavItem, isMastraPlatform]);

  const pathCount = navigationSections.reduce((count, section) => count + section.items.length, 0);
  const toolingCount = toolEntries.length + processorEntries.length + mcpServers.length;
  const evaluationCount = scorerEntries.length;
  const observabilityCount = agentEntries.length + workflowEntries.length + 3;
  const settingsCount = navigationSections.find(section => section.key === 'studio')?.items.length ?? 0;
  const allCount =
    pathCount + agentEntries.length + workflowEntries.length + toolingCount + evaluationCount + observabilityCount;

  const scopeOptions: ScopeOption[] = [
    { id: 'all', label: 'All', icon: <SearchIcon />, count: allCount },
    { id: 'paths', label: 'Paths', icon: <RouteIcon />, count: pathCount },
    { id: 'agents', label: 'Agents', icon: <AgentIcon />, count: agentEntries.length },
    { id: 'workflows', label: 'Workflows', icon: <WorkflowIcon />, count: workflowEntries.length },
    { id: 'tooling', label: 'Tooling', icon: <Layers3Icon />, count: toolingCount },
    { id: 'evaluation', label: 'Evaluation', icon: <GaugeIcon />, count: evaluationCount },
    { id: 'observability', label: 'Intelligence', icon: <EyeIcon />, count: observabilityCount },
    { id: 'settings', label: 'Studio', icon: <SlidersHorizontalIcon />, count: settingsCount },
  ];

  const showPaths = activeScope === 'all' || activeScope === 'paths';
  const showAgents = activeScope === 'all' || activeScope === 'agents';
  const showWorkflows = activeScope === 'all' || activeScope === 'workflows';
  const showTooling = activeScope === 'all' || activeScope === 'tooling';
  const showEvaluation = activeScope === 'all' || activeScope === 'evaluation';
  const showObservability = activeScope === 'all' || activeScope === 'observability';
  const showSettings = activeScope === 'settings';

  const visiblePathSections = React.useMemo(() => {
    const sections: NavigationSection[] = [];
    for (const section of navigationSections) {
      if (showSettings) {
        if (section.key === 'studio') sections.push(section);
        continue;
      }

      const isVisible =
        (activeScope === 'evaluation' && section.key === 'evaluation') ||
        (activeScope === 'observability' && section.key === 'observability') ||
        (showPaths && (activeScope === 'all' || section.key !== 'studio'));

      if (isVisible) sections.push(section);
    }
    return sections;
  }, [activeScope, navigationSections, showPaths, showSettings]);

  return (
    <CommandPaletteDialog
      open={open}
      onOpenChange={updateOpen}
      title="Mastra Studio Search"
      description="Search Studio routes and runtime entities"
    >
      <CommandPaletteInput placeholder="Search Studio, agents, workflows, tools, paths..." />
      <CommandPaletteBody>
        <CommandRail scopeOptions={scopeOptions} activeScope={activeScope} onScopeChange={setActiveScope} />
        <CommandPaletteResults aria-label="Search results" footer={<CommandPaletteFooter label="Studio search" />}>
          <CommandEmpty>No matching results.</CommandEmpty>
          <CommandResults sidebar={sidebar} activeScope={activeScope} closeCommand={closeCommand} />
          <PathSectionResults sections={visiblePathSections} handleSelect={handleSelect} />
          <AgentResults visible={showAgents} entries={agentEntries} paths={paths} handleSelect={handleSelect} />
          <WorkflowResults
            visible={showWorkflows}
            entries={workflowEntries}
            paths={paths}
            handleSelect={handleSelect}
          />
          <ToolResults visible={showTooling} entries={toolEntries} paths={paths} handleSelect={handleSelect} />
          <ProcessorResults
            visible={showTooling}
            entries={processorEntries}
            paths={paths}
            handleSelect={handleSelect}
          />
          <McpServerResults visible={showTooling} entries={mcpServers} paths={paths} handleSelect={handleSelect} />
          <ObservabilityResults
            visible={showObservability}
            agentEntries={agentEntries}
            workflowEntries={workflowEntries}
            handleSelect={handleSelect}
          />
          <EvaluationResults
            visible={showEvaluation}
            entries={scorerEntries}
            paths={paths}
            handleSelect={handleSelect}
          />
        </CommandPaletteResults>
      </CommandPaletteBody>
    </CommandPaletteDialog>
  );
};
