import type { Meta, StoryObj } from '@storybook/react-vite';
import { Fragment } from 'react';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
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
    name: {
      control: 'inline-radio',
      options: ['serverless', 'small', 'medium', 'large', 'credits', 'free', 'starter', 'teams', 'enterprise'],
    },
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

export const CreditsCard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Hovering or focusing the card drops a coin onto the short stack.',
      },
    },
  },
  render: () => (
    <Card className={cn(billingIllustrationHoverGroup, 'relative flex w-126 flex-col gap-4 overflow-clip p-5')}>
      <BillingIllustration
        name="credits"
        tone="muted"
        className="absolute top-1 right-1 h-21.5 w-auto mask-b-from-50% mask-l-from-50%"
      />
      <div className="flex flex-col gap-1">
        <Txt variant="label" tone="muted">
          Credits
        </Txt>
        <div className="flex items-baseline gap-2">
          <Txt variant="display" className="tabular-nums">
            $2.96
          </Txt>
          <Txt variant="body-sm" tone="muted">
            $2.04 spent this month
          </Txt>
        </div>
        <Txt variant="caption" tone="muted">
          Use with Mastra Gateway or usage beyond your allowance.
        </Txt>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="primary">Add credits</Button>
        <div className="flex items-center gap-1.5">
          <Txt variant="body-sm" tone="muted">
            Auto top-up
          </Txt>
          <Badge>Off</Badge>
        </div>
      </div>
    </Card>
  ),
};

const plans = [
  { name: 'free', label: 'Free', price: '$0', description: 'Build and test your first agents.' },
  { name: 'starter', label: 'Starter', price: '$25', description: 'Higher allowances and 1× Small.' },
  { name: 'teams', label: 'Teams', price: '$250', description: 'Two Medium projects and SOC 2.' },
  {
    name: 'enterprise',
    label: 'Enterprise',
    price: 'Custom',
    description: 'RBAC, SSO, audit logs and custom allowances.',
  },
] satisfies Array<{ name: BillingIllustrationName; label: string; price: string; description: string }>;

const planFade = 'mask-b-from-50% mask-l-from-50%';

export const PlanCards: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Each plan card shows its drawing faded behind the top right. Hovering or focusing inside a card turns its screens and windows on, one after another.',
      },
    },
  },
  render: () => (
    <div className="flex w-292 rounded-2xl bg-dialog p-4 shadow-overlay">
      {plans.map(({ name, label, price, description }, index) => (
        <Fragment key={name}>
          {index > 0 && <div className="w-px shrink-0 bg-border" />}
          <div
            className={cn(
              billingIllustrationHoverGroup,
              'relative flex flex-1 flex-col gap-2 overflow-clip rounded-xl px-4 py-5',
              name === 'starter' && 'bg-fill-subtle',
            )}
          >
            <BillingIllustration
              name={name}
              tone="faded"
              className={cn(planFade, 'absolute -top-1.5 -right-1.5 size-28')}
            />
            <Txt variant="label">{label}</Txt>
            <Txt variant="display">{price}</Txt>
            <Txt variant="body-sm" tone="muted" className="max-w-48">
              {description}
            </Txt>
          </div>
        </Fragment>
      ))}
    </div>
  ),
};

export const CurrentPlanCard: Story = {
  render: () => (
    <Card className={cn(billingIllustrationHoverGroup, 'relative flex w-126 flex-col gap-1 overflow-clip p-5')}>
      <BillingIllustration
        name="starter"
        tone="muted"
        className={cn(planFade, 'absolute top-1 right-1 h-21.5 w-auto')}
      />
      <Txt variant="label" tone="muted">
        Current plan
      </Txt>
      <Txt variant="display">Starter</Txt>
      <Txt variant="body-sm" tone="muted">
        1× Small included.
      </Txt>
    </Card>
  ),
};
