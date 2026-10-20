import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button';
import { Table } from '../Table/Table';
import { Txt } from '../Txt/Txt';
import { BillingIllustration, billingIllustrationHoverGroup } from './billing-illustration';
import type { BillingIllustrationName } from './billing-illustration';
import { cn } from '@/lib/utils';

const meta = {
  title: 'Elements/BillingIllustration',
  component: BillingIllustration,
  parameters: {
    layout: 'centered',
  },
  args: {
    name: 'small',
    tone: 'ink',
  },
  argTypes: {
    name: { control: 'inline-radio', options: ['serverless', 'small', 'medium', 'large'] },
    tone: { control: 'inline-radio', options: ['ink', 'muted', 'faded'] },
  },
} satisfies Meta<typeof BillingIllustration>;

export default meta;
type Story = StoryObj<typeof meta>;

const projectSizes = [
  { name: 'serverless', label: 'Serverless' },
  { name: 'small', label: 'Small' },
  { name: 'medium', label: 'Medium' },
  { name: 'large', label: 'Large' },
] satisfies Array<{ name: BillingIllustrationName; label: string }>;

export const Default: Story = {};

export const ProjectSizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Hovering a size powers it on: the units lift off the plate, idle lights turn on, and Serverless turns solid. Put billingIllustrationHoverGroup on a row or card to start it from the whole element. Nothing moves with reduced motion.',
      },
    },
  },
  render: ({ tone }) => (
    <div className="flex gap-6">
      {projectSizes.map(({ name, label }) => (
        <div key={name} className={cn(billingIllustrationHoverGroup, 'flex flex-col items-center gap-2')}>
          <BillingIllustration name={name} tone={tone} />
          <Txt variant="caption" tone="muted">
            {label}
          </Txt>
        </div>
      ))}
    </div>
  ),
};

const projects = [
  { project: 'support-agent', size: 'small', label: 'Small', compute: '1 GB memory, 1 vCPU', price: 'Included' },
  {
    project: 'research-workflows',
    size: 'serverless',
    label: 'Serverless',
    compute: '148 GB-hours, 112 vCPU-hours',
    price: 'Free + usage',
  },
  { project: 'billing-bot', size: 'medium', label: 'Medium', compute: '4 GB memory, 4 vCPU', price: '$100 / month' },
  { project: 'ingest-pipeline', size: 'large', label: 'Large', compute: '8 GB memory, 8 vCPU', price: '$200 / month' },
] satisfies Array<{ project: string; size: BillingIllustrationName; label: string; compute: string; price: string }>;

export const ProjectRows: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <Txt as="h2" id="billing-projects" variant="subheading">
        Projects
      </Txt>
      <Table variant="inset" aria-labelledby="billing-projects">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-full">Project</Table.Head>
            <Table.Head>Compute</Table.Head>
            <Table.Head align="end">Price</Table.Head>
            <Table.Head align="end">
              <span className="sr-only">Actions</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {projects.map(({ project, size, label, compute, price }) => (
            <Table.Row key={project} className={billingIllustrationHoverGroup}>
              <Table.Cell>
                <div className="flex items-center gap-4 py-1">
                  <BillingIllustration name={size} className="size-9" />
                  <div className="flex flex-col">
                    <Txt variant="label">{project}</Txt>
                    <Txt variant="body-sm" tone="muted">
                      {label}
                    </Txt>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>{compute}</Table.Cell>
              <Table.Cell align="end">{price}</Table.Cell>
              <Table.Cell align="end">
                <Button size="sm" aria-label={`Resize ${project}`}>
                  Resize
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  ),
};
