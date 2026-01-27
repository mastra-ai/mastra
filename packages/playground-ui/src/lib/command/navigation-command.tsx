import { Cpu, EyeIcon, GaugeIcon, PackageIcon } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/ds/components/Command';
import { AgentIcon, McpServerIcon, SettingsIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { useMastraPlatform } from '@/lib/mastra-platform';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useNavigationCommand } from './use-navigation-command';

export const NavigationCommand = () => {
  const { open, setOpen } = useNavigationCommand();
  const { navigate, paths } = useLinkComponent();
  const { isMastraPlatform } = useMastraPlatform();

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
          <CommandItem value="all agents" onSelect={() => handleSelect('/agents')}>
            <AgentIcon className="text-neutral3" />
            <span>All Agents</span>
          </CommandItem>
          <CommandItem value="all workflows" onSelect={() => handleSelect('/workflows')}>
            <WorkflowIcon className="text-neutral3" />
            <span>All Workflows</span>
          </CommandItem>
          <CommandItem value="all tools" onSelect={() => handleSelect('/tools')}>
            <ToolsIcon className="text-neutral3" />
            <span>All Tools</span>
          </CommandItem>
          <CommandItem value="all scorers" onSelect={() => handleSelect('/scorers')}>
            <GaugeIcon className="text-neutral3" />
            <span>All Scorers</span>
          </CommandItem>
          <CommandItem value="all processors" onSelect={() => handleSelect('/processors')}>
            <Cpu className="text-neutral3" />
            <span>All Processors</span>
          </CommandItem>
          <CommandItem value="all mcp servers" onSelect={() => handleSelect('/mcps')}>
            <McpServerIcon className="text-neutral3" />
            <span>All MCP Servers</span>
          </CommandItem>
          <CommandItem value="observability traces" onSelect={() => handleSelect('/observability')}>
            <EyeIcon className="text-neutral3" />
            <span>Observability</span>
          </CommandItem>
          {!isMastraPlatform && (
            <>
              <CommandItem value="settings" onSelect={() => handleSelect('/settings')}>
                <SettingsIcon className="text-neutral3" />
                <span>Settings</span>
              </CommandItem>
              <CommandItem value="templates" onSelect={() => handleSelect('/templates')}>
                <PackageIcon className="text-neutral3" />
                <span>Templates</span>
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {agentEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              {agentEntries.map(([id, agent]) => (
                <CommandItem key={id} value={`agent ${agent.name}`} onSelect={() => handleSelect(paths.agentLink(id))}>
                  <AgentIcon className="text-neutral3" />
                  <span>{agent.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {workflowEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workflows">
              {workflowEntries.map(([id, workflow]) => (
                <CommandItem
                  key={id}
                  value={`workflow ${workflow.name}`}
                  onSelect={() => handleSelect(paths.workflowLink(id))}
                >
                  <WorkflowIcon className="text-neutral3" />
                  <span>{workflow.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {toolEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tools">
              {toolEntries.map(([id, tool]) => (
                <CommandItem key={id} value={`tool ${tool.id}`} onSelect={() => handleSelect(paths.toolLink(id))}>
                  <ToolsIcon className="text-neutral3" />
                  <span>{tool.id}</span>
                </CommandItem>
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
                  <CommandItem
                    key={id}
                    value={`scorer ${name}`}
                    onSelect={() => handleSelect(paths.scorerLink(id))}
                  >
                    <GaugeIcon className="text-neutral3" />
                    <span>{name}</span>
                  </CommandItem>
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
                  <CommandItem
                    key={processor.id}
                    value={`processor ${displayName}`}
                    onSelect={() => handleSelect(targetPath)}
                  >
                    <Cpu className="text-neutral3" />
                    <span>{displayName}</span>
                  </CommandItem>
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
                <CommandItem
                  key={server.id}
                  value={`mcp server ${server.name}`}
                  onSelect={() => handleSelect(paths.mcpServerLink(server.id))}
                >
                  <McpServerIcon className="text-neutral3" />
                  <span>{server.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
