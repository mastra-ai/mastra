import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../Button';
import { DisclosureChevron } from '../DisclosureChevron';
import { Meter } from '../Meter';
import { ScrollArea } from '../ScrollArea';
import { Table } from '../Table';
import { Txt } from '../Txt';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
import { SettingsContainer } from '@/ds/new/settings';

const meta: Meta<typeof Collapsible> = {
  title: 'Layout/Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-[350px]">
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between">
          Click to expand
          <DisclosureChevron className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border border-border bg-background p-4">
        <p className="text-body text-foreground">This is the collapsible content. It can contain any elements.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-[350px]">
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between">
          Section Title
          <DisclosureChevron className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border border-border bg-background p-4">
        <p className="text-body text-foreground">This section is open by default.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const SettingsSection: Story = {
  render: () => (
    <div className="w-100 space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between py-2 text-subheading text-foreground hover:text-white">
            Advanced Settings
            <DisclosureChevron className="size-4" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-body text-foreground">Debug mode</span>
            <span className="text-body text-muted-foreground">Disabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-foreground">Verbose logging</span>
            <span className="text-body text-muted-foreground">Off</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-foreground">Cache timeout</span>
            <span className="text-body text-muted-foreground">300s</span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

export const MultipleCollapsibles: Story = {
  render: () => (
    <div className="w-[350px] space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 1
            <DisclosureChevron className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-body text-foreground">Content for section 1</p>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 2
            <DisclosureChevron className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-body text-foreground">Content for section 2</p>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 3
            <DisclosureChevron className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-body text-foreground">Content for section 3</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

export const FillsConstrainedPanel: Story = {
  render: () => (
    <Collapsible
      defaultOpen
      className="flex h-64 w-[350px] flex-col overflow-hidden rounded-md border border-border bg-background"
    >
      <CollapsibleTrigger className="flex w-full shrink-0 items-center justify-between px-4 py-2 text-subheading text-foreground">
        Recent runs
        <DisclosureChevron className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent fill className="flex min-h-0 flex-col">
        <ScrollArea className="min-h-0 flex-1 border-t border-border">
          <ul className="divide-y divide-border">
            {Array.from({ length: 20 }, (_, index) => (
              <li key={index} className="px-4 py-2 text-body text-foreground">
                Run {index + 1}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  ),
};

type ProjectUsage = { name: string; kind?: string; used: string; share: string };

type AllowanceUsage = {
  name: string;
  noun: string;
  value: number;
  max: number;
  unit: string;
  overNote?: string;
  overage?: string;
  projects: ProjectUsage[];
};

const ALLOWANCES: AllowanceUsage[] = [
  {
    name: 'Memory',
    noun: 'memory',
    value: 148,
    max: 360,
    unit: 'GB-hours',
    projects: [
      { name: 'research-workflows', kind: 'Serverless', used: '112 GB-hours', share: '76%' },
      { name: 'Sandboxes', used: '36 GB-hours', share: '24%' },
    ],
  },
  {
    name: 'vCPU',
    noun: 'vCPU',
    value: 112,
    max: 100,
    unit: 'vCPU-hours',
    overNote: '12 over, at $0.10 / vCPU-hour',
    overage: '$1.20',
    projects: [
      { name: 'research-workflows', kind: 'Serverless', used: '88 vCPU-hours', share: '79%' },
      { name: 'Sandboxes', used: '24 vCPU-hours', share: '21%' },
    ],
  },
  {
    name: 'Egress',
    noun: 'egress',
    value: 3.4,
    max: 10,
    unit: 'GB',
    projects: [
      { name: 'support-agent', kind: 'Small', used: '2.6 GB', share: '76%' },
      { name: 'research-workflows', kind: 'Serverless', used: '0.8 GB', share: '24%' },
    ],
  },
];

function AllowanceRow({ allowance }: { allowance: AllowanceUsage }) {
  const { name, noun, value, max, unit, overNote, overage, projects } = allowance;
  const valueClassName = value > max ? 'text-destructive-indicator' : 'text-foreground';
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-baseline gap-4 px-6 py-4 text-left">
        <Txt as="span" variant="label" tone="ink" className="w-32 shrink-0">
          {name}
        </Txt>
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-baseline gap-3">
            <Txt as="span" variant="body-sm" tone="muted" className="tabular-nums">
              <span className={valueClassName}>{value}</span> of {max} {unit}
            </Txt>
            {overNote && (
              <Txt as="span" variant="caption" tone="muted">
                {overNote}
              </Txt>
            )}
            {overage && (
              <Txt as="span" variant="body-sm" tone="muted" className="ml-auto tabular-nums">
                <span className="text-destructive-indicator">{overage}</span> overage
              </Txt>
            )}
          </span>
          <Meter value={value} max={max} aria-label={name} aria-hidden />
        </span>
        <DisclosureChevron direction="right" className="size-icon-sm self-center" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        <Table variant="inset" aria-label={`${name} by project`}>
          <Table.Header placement="inside">
            <Table.Row>
              <Table.Head className="w-full">Project</Table.Head>
              <Table.Head align="end">Used</Table.Head>
              <Table.Head align="end">Share</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {projects.map(project => (
              <Table.Row key={project.name}>
                <Table.Cell>
                  <span className="flex items-baseline gap-2">
                    {project.name}
                    {project.kind && (
                      <Txt as="span" variant="caption" tone="muted">
                        {project.kind}
                      </Txt>
                    )}
                  </span>
                </Table.Cell>
                <Table.Cell align="end">{project.used}</Table.Cell>
                <Table.Cell align="end" tone="muted">
                  {project.share}
                </Table.Cell>
              </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Button variant="link" size="sm" iconEnd={<ArrowUpRight />} render={<a href="#usage-by-project" />}>
                  View {noun} by project
                </Button>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const ExpandableRows: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Rows that open in place, as on the Usage page: a `SettingsContainer` of `Collapsible`s, each trigger a full-width row with its reading and `Meter`, each panel an inset `Table` whose header and closing link sit inside the inset with the rows (`Table.Header placement="inside"`). Any number can be open at once, and the chevron is the only change on an open row.',
      },
    },
  },
  render: () => (
    <div className="max-w-4xl">
      <SettingsContainer>
        {ALLOWANCES.map(allowance => (
          <AllowanceRow key={allowance.name} allowance={allowance} />
        ))}
      </SettingsContainer>
    </div>
  ),
};
