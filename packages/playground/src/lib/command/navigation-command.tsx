import {
  useMaybeSidebar,
  AgentIcon,
  McpServerIcon,
  SettingsIcon,
  ToolsIcon,
  WorkflowIcon,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@mastra/playground-ui';
import { Cpu, EyeIcon, GaugeIcon, PackageIcon, PanelLeftIcon } from 'lucide-react';
import React from 'react';

import { useNavigationCommand } from './use-navigation-command';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';
import { useMastraPlatform } from '@/lib/mastra-platform';
import { cn } from '@/lib/utils';

type NavigationCommandItemProps = Omit<React.ComponentProps<typeof CommandItem>, 'children'> & {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  shortcut?: React.ReactNode;
};

const NavigationCommandItem = ({
  icon,
  title,
  subtitle,
  shortcut,
  className,
  ...props
}: NavigationCommandItemProps) => {
  return (
    <CommandItem className={cn('h-auto items-start gap-3 py-2', className)} {...props}>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-neutral3 [&>svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-ui-sm font-medium leading-ui-sm text-neutral6">{title}</span>
        {subtitle && <span className="truncate text-ui-xs leading-ui-xs text-neutral3">{subtitle}</span>}
      </span>
      {shortcut}
    </CommandItem>
  );
};

export const NavigationCommand = () => {
  const { open, setOpen } = useNavigationCommand();
  const { navigate, paths } = useLinkComponent();
  const { isMastraPlatform } = useMastraPlatform();
  const sidebar = useMaybeSidebar();

  const { data: agents = {} } = useAgents();
  const { data: workflows = {} } = useWorkflows();
  const { data: tools = {} } = useTools();
  const { data: processors = {} } = useProcessors();
  const { data: mcpServers = [] } = useMCPServers();
  const { data: scorers = {} } = useScorers();

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const agentEntries = Object.entries(agents);
  const workflowEntries = Object.entries(workflows);
  const toolEntries = Object.entries(tools);
  const processorEntries = Object.values(processors).filter(p => p.phases && p.phases.length > 0);
  const scorerEntries = Object.entries(scorers);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Navigation"
      description="Search and navigate to any entity"
    >
      <CommandInput placeholder="Search or navigate..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {sidebar && (
            <NavigationCommandItem
              value="toggle sidebar collapse expand layout panel"
              onSelect={() => {
                sidebar.toggleSidebar();
                setOpen(false);
              }}
              icon={<PanelLeftIcon />}
              title="Toggle Sidebar"
              subtitle="Layout"
              shortcut={<CommandShortcut>Ctrl+B</CommandShortcut>}
            />
          )}
          <NavigationCommandItem
            value="all agents agents chat /agents"
            onSelect={() => handleSelect('/agents')}
            icon={<AgentIcon />}
            title="All Agents"
            subtitle="Browse and chat with agents"
          />
          <NavigationCommandItem
            value="all workflows workflows graph /workflows"
            onSelect={() => handleSelect('/workflows')}
            icon={<WorkflowIcon />}
            title="All Workflows"
            subtitle="Browse workflow graphs"
          />
          <NavigationCommandItem
            value="all tools tools /tools"
            onSelect={() => handleSelect('/tools')}
            icon={<ToolsIcon />}
            title="All Tools"
            subtitle="Inspect available tools"
          />
          <NavigationCommandItem
            value="all scorers scores evaluation /scorers"
            onSelect={() => handleSelect('/scorers')}
            icon={<GaugeIcon />}
            title="All Scorers"
            subtitle="Manage evaluation scorers"
          />
          <NavigationCommandItem
            value="all processors processors /processors"
            onSelect={() => handleSelect('/processors')}
            icon={<Cpu />}
            title="All Processors"
            subtitle="Review input and output processors"
          />
          <NavigationCommandItem
            value="all mcp servers mcp /mcps"
            onSelect={() => handleSelect('/mcps')}
            icon={<McpServerIcon />}
            title="All MCP Servers"
            subtitle="Browse connected MCP servers"
          />
          <NavigationCommandItem
            value="observability traces telemetry /observability"
            onSelect={() => handleSelect('/observability')}
            icon={<EyeIcon />}
            title="Observability"
            subtitle="Inspect traces and telemetry"
          />
          {!isMastraPlatform && (
            <>
              <NavigationCommandItem
                value="settings configuration studio /settings"
                onSelect={() => handleSelect('/settings')}
                icon={<SettingsIcon />}
                title="Settings"
                subtitle="Configure Studio"
              />
              <NavigationCommandItem
                value="templates starter projects examples /templates"
                onSelect={() => handleSelect('/templates')}
                icon={<PackageIcon />}
                title="Templates"
                subtitle="Create from a starter"
              />
            </>
          )}
        </CommandGroup>

        {agentEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              {agentEntries.map(([id, agent]) => (
                <React.Fragment key={id}>
                  <NavigationCommandItem
                    value={`${agent.name} ${id} chat agent conversation ${paths.agentLink(id)}`}
                    onSelect={() => handleSelect(paths.agentLink(id))}
                    icon={<AgentIcon />}
                    title={`${agent.name}: Chat`}
                    subtitle="Agent conversation"
                  />
                  <NavigationCommandItem
                    value={`${agent.name} ${id} traces agent observability telemetry`}
                    onSelect={() => handleSelect(`/observability?entity=${id}`)}
                    icon={<EyeIcon />}
                    title={`${agent.name}: Traces`}
                    subtitle="Agent observability"
                  />
                </React.Fragment>
              ))}
            </CommandGroup>
          </>
        )}

        {workflowEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workflows">
              {workflowEntries.map(([id, workflow]) => (
                <React.Fragment key={id}>
                  <NavigationCommandItem
                    value={`${workflow.name} ${id} graph workflow view ${paths.workflowLink(id)}`}
                    onSelect={() => handleSelect(paths.workflowLink(id))}
                    icon={<WorkflowIcon />}
                    title={`${workflow.name}: Graph`}
                    subtitle="Workflow view"
                  />
                  <NavigationCommandItem
                    value={`${workflow.name} ${id} traces workflow observability telemetry`}
                    onSelect={() => handleSelect(`/observability?entity=${workflow.name}`)}
                    icon={<EyeIcon />}
                    title={`${workflow.name}: Traces`}
                    subtitle="Workflow observability"
                  />
                </React.Fragment>
              ))}
            </CommandGroup>
          </>
        )}

        {toolEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tools">
              {toolEntries.map(([id, tool]) => (
                <NavigationCommandItem
                  key={id}
                  value={`tool ${tool.id} ${id} ${paths.toolLink(id)}`}
                  onSelect={() => handleSelect(paths.toolLink(id))}
                  icon={<ToolsIcon />}
                  title={tool.id}
                  subtitle="Tool"
                />
              ))}
            </CommandGroup>
          </>
        )}

        {scorerEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Scorers">
              {scorerEntries.map(([id, scorer]) => {
                const name = scorer.scorer?.config?.name || scorer.scorer?.config?.id || id;
                return (
                  <NavigationCommandItem
                    key={id}
                    value={`scorer score evaluation ${name} ${id} ${paths.scorerLink(id)}`}
                    onSelect={() => handleSelect(paths.scorerLink(id))}
                    icon={<GaugeIcon />}
                    title={name}
                    subtitle="Scorer"
                  />
                );
              })}
            </CommandGroup>
          </>
        )}

        {processorEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Processors">
              {processorEntries.map(processor => {
                const displayName = processor.name || processor.id;
                const targetPath = processor.isWorkflow
                  ? paths.workflowLink(processor.id) + '/graph'
                  : paths.processorLink(processor.id);
                return (
                  <NavigationCommandItem
                    key={processor.id}
                    value={`processor ${displayName} ${processor.id} ${targetPath}`}
                    onSelect={() => handleSelect(targetPath)}
                    icon={<Cpu />}
                    title={displayName}
                    subtitle={processor.isWorkflow ? 'Workflow processor' : 'Processor'}
                  />
                );
              })}
            </CommandGroup>
          </>
        )}

        {mcpServers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="MCP Servers">
              {mcpServers.map(server => (
                <NavigationCommandItem
                  key={server.id}
                  value={`mcp server ${server.name} ${server.id} ${paths.mcpServerLink(server.id)}`}
                  onSelect={() => handleSelect(paths.mcpServerLink(server.id))}
                  icon={<McpServerIcon />}
                  title={server.name}
                  subtitle="MCP server"
                />
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
