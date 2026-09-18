import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowLeftIcon, CircleCheckIcon, LoaderIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AgentIcon } from '../../icons/AgentIcon';
import { DatasetsIcon } from '../../icons/DatasetsIcon';
import { Icon } from '../../icons/Icon';
import { WorkflowIcon } from '../../icons/WorkflowIcon';
import { WorkspacesIcon } from '../../icons/WorkspacesIcon';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { CopyButton } from '../CopyButton';
import { Header } from '../Header';
import { Txt } from '../Txt';
import { Breadcrumb } from './Breadcrumb';
import { Crumb } from './breadcrumb-crumb';
import { cn } from '@/lib/utils';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Navigation/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/home">
        Home
      </Crumb>
      <Crumb as="a" to="/products">
        Products
      </Crumb>
      <Crumb as="span" to="/products/item" isCurrent>
        Item Details
      </Crumb>
    </Breadcrumb>
  ),
};

export const TwoLevels: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/dashboard">
        Dashboard
      </Crumb>
      <Crumb as="span" to="/dashboard/settings" isCurrent>
        Settings
      </Crumb>
    </Breadcrumb>
  ),
};

export const ChevronSeparators: Story = {
  render: () => (
    <Breadcrumb label="Navigation" separator="chevron">
      <Crumb as="a" to="/dashboard">
        Dashboard
      </Crumb>
      <Crumb as="span" to="/dashboard/settings" isCurrent>
        Settings
      </Crumb>
    </Breadcrumb>
  ),
};

export const ManyLevels: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/home">
        Home
      </Crumb>
      <Crumb as="a" to="/workspace">
        Workspace
      </Crumb>
      <Crumb as="a" to="/workspace/projects">
        Projects
      </Crumb>
      <Crumb as="a" to="/workspace/projects/mastra">
        Mastra
      </Crumb>
      <Crumb as="span" to="/workspace/projects/mastra/agents" isCurrent>
        Agents
      </Crumb>
    </Breadcrumb>
  ),
};

const agents = [
  { label: 'Weather agent', value: 'weather' },
  { label: 'Support agent', value: 'support' },
  { label: 'Research agent', value: 'research' },
];

/** Icon-only switcher, as used in the `action` slot of every entity crumb. */
const AgentSwitcher = () => (
  <Combobox options={agents} value="weather" variant="ghost" size="icon-sm" aria-label="Switch agent" />
);

const projects = [
  { label: 'Production project', value: 'production' },
  { label: 'Staging project', value: 'staging' },
  { label: 'Development project', value: 'development' },
];

const ProjectExitAction = ({ onExit }: { onExit: () => void }) => (
  <span
    className={cn(
      'flex max-w-0 shrink-0 items-center overflow-hidden opacity-0',
      'transition-[max-width,opacity] duration-normal ease-in-out motion-reduce:transition-none',
      'group-focus-within:max-w-6 group-focus-within:opacity-100 group-hover:max-w-6 group-hover:opacity-100 pointer-coarse:max-w-6 pointer-coarse:opacity-100',
    )}
  >
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0 hover:!bg-transparent active:!bg-transparent"
      aria-label="Exit project"
      onClick={onExit}
    >
      <XIcon />
    </Button>
  </span>
);

function WithActionExample() {
  const [project, setProject] = useState('production');
  const [showProject, setShowProject] = useState(true);

  return (
    <Breadcrumb.Bar actions={<Button size="sm">Deploy</Button>}>
      <Breadcrumb.Item pathname="/projects">
        <Crumb
          as={showProject ? 'a' : 'span'}
          to={showProject ? '/projects' : undefined}
          isCurrent={!showProject}
          icon={<WorkspacesIcon />}
        >
          Projects
        </Crumb>
      </Breadcrumb.Item>
      {showProject && (
        <Breadcrumb.Item pathname={`/projects/${project}`}>
          <Crumb
            as="span"
            isCurrent
            className="px-0"
            action={<ProjectExitAction onExit={() => setShowProject(false)} />}
          >
            <Combobox
              options={projects}
              value={project}
              onValueChange={setProject}
              variant="ghost"
              size="sm"
              className="hover:!bg-transparent active:!bg-transparent data-[popup-open]:!bg-transparent [&_svg]:!size-3"
              aria-label="Switch project"
              footer={
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  className="w-full justify-start"
                  icon={<ArrowLeftIcon />}
                  onClick={() => setShowProject(false)}
                >
                  Back to projects
                </Button>
              }
            />
          </Crumb>
        </Breadcrumb.Item>
      )}
    </Breadcrumb.Bar>
  );
}

export const WithAction: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <WithActionExample />,
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="span" to="/dashboard" isCurrent>
        Dashboard
      </Crumb>
    </Breadcrumb>
  ),
};

/** A clamped label must ellipsize, not cut mid-glyph, and keep its descenders. */
export const TruncatedLabel: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/workspaces" icon={<WorkspacesIcon />}>
        Staging deployment registry for the european weather forecasting platform
      </Crumb>
      <Crumb as="span" to="/workspaces/playground" isCurrent>
        Agent playground copy with a deliberately long name that overflows the current crumb budget
      </Crumb>
    </Breadcrumb>
  ),
};

const Usage = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Txt variant="ui-xs" className="text-neutral3">
      {title}
    </Txt>
    <Header className="h-10 min-h-10 w-220 gap-2 overflow-hidden px-2">
      <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
        {children}
      </Breadcrumb>
    </Header>
  </div>
);

/**
 * Every real breadcrumb shape used in Studio, rendered inside the same `Header`
 * chrome as `RouteHeader`. A crumb is one of three forms: a current `span`, a
 * link, or a label (span/link) with an icon-only control in `action`.
 */
export const AllAppUsages: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-6">
      <Usage title="1. Root page — single current crumb">
        <Crumb as="span" isCurrent icon={<AgentIcon />}>
          Agents
        </Crumb>
      </Usage>

      <Usage title="2. Nav link + current label (Templates, Integrations, Create new dataset)">
        <Crumb as="a" to="/datasets" icon={<DatasetsIcon />}>
          Datasets
        </Crumb>
        <Crumb as="span" isCurrent>
          Create new dataset
        </Crumb>
      </Usage>

      <Usage title="3. Entity page — current label + switcher (Agent, Tool, Workflow, Scorer, Processor, MCP, Dataset)">
        <Crumb as="a" to="/agents" icon={<AgentIcon />}>
          Agents
        </Crumb>
        <Crumb as="span" isCurrent action={<AgentSwitcher />}>
          Weather agent
        </Crumb>
      </Usage>

      <Usage title="4. Entity link + switcher → leaf (Agent → tool, Workflow → run, Dataset → item, MCP → tool)">
        <Crumb as="a" to="/agents" icon={<AgentIcon />}>
          Agents
        </Crumb>
        <Crumb as="a" to="/agents/weather" action={<AgentSwitcher />}>
          Weather agent
        </Crumb>
        <Crumb as="span" isCurrent>
          get-forecast
        </Crumb>
      </Usage>

      <Usage title="5. Status icon + label (Experiment) — current and link">
        <Crumb as="a" to="/experiments" icon={<DatasetsIcon />}>
          Experiments
        </Crumb>
        <Crumb as="a" to="/experiments/nightly" icon={<CircleCheckIcon className="text-accent1" />}>
          Nightly regression
        </Crumb>
        <Crumb as="span" isCurrent icon={<LoaderIcon className="animate-spin" />}>
          item-0042
        </Crumb>
      </Usage>

      <Usage title="6. Truncated id + copy action (Workflow run)">
        <Crumb as="a" to="/workflows" icon={<WorkflowIcon />}>
          Workflows
        </Crumb>
        <Crumb as="a" to="/workflows/weather" action={<AgentSwitcher />}>
          Weather workflow
        </Crumb>
        <Crumb
          as="span"
          isCurrent

          action={
            <CopyButton
              content="8f3c2a1b-1d2e-4c5f-9a7b-3e6d8c0f1a2b"
              tooltip="Copy run id"
              variant="ghost"
              size="icon-sm"
            />
          }
        >
          8f3c2a1b
        </Crumb>
      </Usage>

      <Usage title="7. Loading (Prompt block, Stored scorer, Agent builder title)">
        <Crumb as="a" to="/agent-builder/agents">
          Agent list
        </Crumb>
        <Crumb as="span" isCurrent isLoading />
      </Usage>

      <Usage title="8. Long labels — built-in truncation (12rem nav / 20rem current), with and without action">
        <Crumb as="a" to="/agents" icon={<AgentIcon />}>
          A very long navigation label that should truncate at twelve rem
        </Crumb>
        <Crumb as="a" to="/agents/x" action={<AgentSwitcher />}>
          A very long entity name that should truncate at twelve rem while keeping the chevron
        </Crumb>
        <Crumb as="span" isCurrent>
          A very long current label that should truncate at twenty rem and keep its ellipsis visible
        </Crumb>
      </Usage>
    </div>
  ),
};

/**
 * A span crumb, a link crumb, a link + switcher, a ghost/sm `Button` and a ghost
 * icon-sm `Button` side by side: same height, radius, padding and hover colors.
 */
export const ControlAlignment: Story = {
  render: () => (
    <div className="bg-surface2 flex items-center gap-1 rounded-lg p-2">
      <Breadcrumb label="Breadcrumb">
        <Crumb as="span" isCurrent>
          Span
        </Crumb>
      </Breadcrumb>
      <Breadcrumb label="Breadcrumb">
        <Crumb as="a" to="/link">
          Link
        </Crumb>
      </Breadcrumb>
      <Breadcrumb label="Breadcrumb">
        <Crumb as="a" to="/agents/weather" action={<AgentSwitcher />}>
          Link + switcher
        </Crumb>
      </Breadcrumb>
      <Button variant="ghost" size="sm">
        Button ghost sm
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Icon button">
        <Icon>
          <AgentIcon />
        </Icon>
      </Button>
    </div>
  ),
};
