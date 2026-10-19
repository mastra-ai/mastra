import type { Meta, StoryObj } from '@storybook/react-vite';
import { Fragment } from 'react';
import { Card } from '../Card';
import { Txt } from '../Txt';
import { PlanIllustration } from './plan-illustration';
import type { PlanIllustrationPlan } from './plan-illustration';
import { cn } from '@/lib/utils';

const meta = {
  title: 'Elements/PlanIllustration',
  component: PlanIllustration,
  parameters: {
    layout: 'centered',
  },
  args: {
    plan: 'starter',
    tone: 'faded',
  },
  argTypes: {
    plan: { control: 'inline-radio', options: ['free', 'starter', 'teams', 'enterprise'] },
    tone: { control: 'inline-radio', options: ['faded', 'muted'] },
  },
} satisfies Meta<typeof PlanIllustration>;

export default meta;
type Story = StoryObj<typeof meta>;

const plans = [
  { plan: 'free', name: 'Free', price: '$0', description: 'Build and test your first agents.' },
  { plan: 'starter', name: 'Starter', price: '$25', description: 'Higher allowances and 1× Small.' },
  { plan: 'teams', name: 'Teams', price: '$250', description: 'Two Medium projects and SOC 2.' },
  {
    plan: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'RBAC, SSO, audit logs and custom allowances.',
  },
] satisfies Array<{ plan: PlanIllustrationPlan; name: string; price: string; description: string }>;

export const Default: Story = {};

export const AllPlans: Story = {
  render: ({ tone }) => (
    <div className="flex gap-6">
      {plans.map(({ plan, name }) => (
        <div key={plan} className="group/plan-card flex flex-col items-center gap-2">
          <PlanIllustration plan={plan} tone={tone} />
          <Txt variant="caption" tone="muted">
            {name}
          </Txt>
        </div>
      ))}
    </div>
  ),
  args: {
    tone: 'muted',
  },
};

export const PlanCards: Story = {
  render: () => (
    <div className="flex w-292 rounded-2xl bg-dialog p-4 shadow-overlay">
      {plans.map(({ plan, name, price, description }, index) => (
        <Fragment key={plan}>
          {index > 0 && <div className="w-px shrink-0 bg-border" />}
          <div
            className={cn(
              'group/plan-card relative flex flex-1 flex-col gap-2 overflow-clip rounded-xl px-4 py-5',
              plan === 'starter' && 'bg-fill-subtle',
            )}
          >
            <PlanIllustration plan={plan} className="absolute -top-1.5 -right-1.5" />
            <Txt variant="label">{name}</Txt>
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
    <Card className="group/plan-card relative flex w-126 flex-col gap-1 overflow-clip p-5">
      <PlanIllustration plan="starter" tone="muted" className="absolute top-1 right-1 h-21.5 w-auto" />
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
