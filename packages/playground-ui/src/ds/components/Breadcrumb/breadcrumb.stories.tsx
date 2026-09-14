import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleCheckIcon, LoaderIcon } from 'lucide-react';
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
import { Breadcrumb, Crumb } from './Breadcrumb';

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

export const WithAction: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/agents" icon={<AgentIcon />}>
        Agents
      </Crumb>
      <Crumb as="span" isCurrent action={<AgentSwitcher />}>
        Weather agent
      </Crumb>
    </Breadcrumb>
  ),
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
      <Crumb as="a" to="/workspaces" className="max-w-40" icon={<WorkspacesIcon />}>
        Staging deployment registry
      </Crumb>
      <Crumb as="span" to="/workspaces/playground" isCurrent className="max-w-40">
        Agent playground copy
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

const NAV = 'max-w-[18rem]';
const CURRENT = 'max-w-[28rem]';

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
        <Crumb as="span" isCurrent className={CURRENT} icon={<AgentIcon />}>
          Agents
        </Crumb>
      </Usage>

      <Usage title="2. Nav link + current label (Templates, Integrations, Create new dataset)">
        <Crumb as="a" to="/datasets" className={NAV} icon={<DatasetsIcon />}>
          Datasets
        </Crumb>
        <Crumb as="span" isCurrent className={CURRENT}>
          Create new dataset
        </Crumb>
      </Usage>

      <Usage title="3. Entity page — current label + switcher (Agent, Tool, Workflow, Scorer, Processor, MCP, Dataset)">
        <Crumb as="a" to="/agents" className={NAV} icon={<AgentIcon />}>
          Agents
        </Crumb>
        <Crumb as="span" isCurrent className={CURRENT} action={<AgentSwitcher />}>
          Weather agent
        </Crumb>
      </Usage>

      <Usage title="4. Entity link + switcher → leaf (Agent → tool, Workflow → run, Dataset → item, MCP → tool)">
        <Crumb as="a" to="/agents" className={NAV} icon={<AgentIcon />}>
          Agents
        </Crumb>
        <Crumb as="a" to="/agents/weather" className={NAV} action={<AgentSwitcher />}>
          Weather agent
        </Crumb>
        <Crumb as="span" isCurrent className={CURRENT}>
          get-forecast
        </Crumb>
      </Usage>

      <Usage title="5. Status icon + label (Experiment) — current and link">
        <Crumb as="a" to="/experiments" className={NAV} icon={<DatasetsIcon />}>
          Experiments
        </Crumb>
        <Crumb as="a" to="/experiments/nightly" className={NAV} icon={<CircleCheckIcon className="text-accent1" />}>
          Nightly regression
        </Crumb>
        <Crumb as="span" isCurrent className={CURRENT} icon={<LoaderIcon className="animate-spin" />}>
          item-0042
        </Crumb>
      </Usage>

      <Usage title="6. Truncated id + copy action (Workflow run)">
        <Crumb as="a" to="/workflows" className={NAV} icon={<WorkflowIcon />}>
          Workflows
        </Crumb>
        <Crumb as="a" to="/workflows/weather" className={NAV} action={<AgentSwitcher />}>
          Weather workflow
        </Crumb>
        <Crumb
          as="span"
          isCurrent
          className={CURRENT}
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
        <Crumb as="a" to="/agent-builder/agents" className={NAV}>
          Agent list
        </Crumb>
        <Crumb as="span" isCurrent isLoading className={CURRENT} />
      </Usage>

      <Usage title="8. Long labels — max-w-[18rem] / max-w-[28rem], with and without action">
        <Crumb as="a" to="/agents" className={NAV} icon={<AgentIcon />}>
          A very long navigation label that should truncate at eighteen rem
        </Crumb>
        <Crumb as="a" to="/agents/x" className={NAV} action={<AgentSwitcher />}>
          A very long entity name that should truncate at eighteen rem while keeping the chevron
        </Crumb>
        <Crumb as="span" isCurrent className={CURRENT}>
          A very long current label that should truncate at twenty-eight rem and keep its ellipsis visible
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
