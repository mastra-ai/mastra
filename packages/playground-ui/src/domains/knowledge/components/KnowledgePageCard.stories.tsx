import type { Meta, StoryObj } from '@storybook/react-vite';
import { KnowledgePageCard } from './KnowledgePageCard';

const meta: Meta<typeof KnowledgePageCard> = {
  title: 'Domains/Knowledge/PageCard',
  component: KnowledgePageCard,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <div className="flex w-72 max-w-full flex-col rounded-md border border-border bg-card px-2 py-1 shadow-overlay">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof KnowledgePageCard>;

export const RefundPolicy: Story = {
  args: {
    name: 'Refund policy',
    kind: 'Page',
    pageRef: 'org:acme#policies/refunds',
    childCount: '3',
    links: { in: 4, out: 1 },
  },
};

export const LongReference: Story = {
  args: {
    ...RefundPolicy.args,
    pageRef:
      'org:acme#policies/CustomerSupportSubscriptionRefundPolicyV2026InternationalEnterpriseAndSmallBusinessPlans',
  },
};
