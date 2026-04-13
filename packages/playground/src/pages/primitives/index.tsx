import { AgentIcon, McpServerIcon, PageHeader, PageLayout, ToolsIcon, WorkflowIcon } from '@mastra/playground-ui';
import { FileTextIcon, Cpu, FolderIcon, GlobeIcon, GripIcon } from 'lucide-react';
import { Link } from 'react-router';

const sections = [
  {
    title: 'Agents',
    description: 'Create and manage AI agents with tools, memory, and custom instructions.',
    icon: AgentIcon,
    href: '/agents',
  },
  {
    title: 'Prompts',
    description: 'Design and version reusable prompt templates for your agents.',
    icon: FileTextIcon,
    href: '/prompts',
  },
  {
    title: 'Workflows',
    description: 'Build step-based execution flows with suspend, resume, and branching.',
    icon: WorkflowIcon,
    href: '/workflows',
  },
  {
    title: 'Processors',
    description: 'Configure data processors for transforming and routing information.',
    icon: Cpu,
    href: '/processors',
  },
  {
    title: 'MCP Servers',
    description: 'Connect to Model Context Protocol servers for external tool access.',
    icon: McpServerIcon,
    href: '/mcps',
  },
  {
    title: 'Tools',
    description: 'Browse and test the tools available to your agents and workflows.',
    icon: ToolsIcon,
    href: '/tools',
  },
  {
    title: 'Workspaces',
    description: 'Organize your projects and resources into isolated workspaces.',
    icon: FolderIcon,
    href: '/workspaces',
  },
  {
    title: 'Request Context',
    description: 'Inspect request-scoped context propagation for dynamic configuration.',
    icon: GlobeIcon,
    href: '/request-context',
  },
];

export default function Primitives() {
  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>
            <GripIcon /> Primitives
          </PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(section => (
            <Link
              key={section.href}
              to={section.href}
              className="group flex flex-col gap-3 rounded-lg border border-border1 bg-surface2 p-5 transition-colors hover:border-accent1 hover:bg-surface3"
            >
              <div className="flex items-center gap-2.5">
                <section.icon className="h-5 w-5 text-icon3 group-hover:text-accent1 transition-colors" />
                <span className="text-ui-md font-medium text-text1">{section.title}</span>
              </div>
              <p className="text-ui-sm text-text3 leading-relaxed">{section.description}</p>
            </Link>
          ))}
        </div>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
