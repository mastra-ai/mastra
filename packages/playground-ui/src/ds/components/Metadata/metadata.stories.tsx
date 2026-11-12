import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, UserRound } from 'lucide-react';
import { Metadata } from './metadata';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

const meta: Meta<typeof Metadata> = {
  title: 'Layout/Metadata',
  component: Metadata,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Metadata>;

export const Issue: Story = {
  render: () => (
    <Txt as="span" variant="caption" tone="muted">
      <Metadata>
        <Metadata.Item>#42</Metadata.Item>
        <Metadata.Item>
          <UserRound size={12} aria-hidden /> damien
        </Metadata.Item>
        <Metadata.Item>
          <Clock size={12} aria-hidden /> 3 hours ago
        </Metadata.Item>
      </Metadata>
    </Txt>
  ),
};

export const Version: Story = {
  render: () => (
    <Metadata>
      <Metadata.Item>
        <Txt as="span" variant="label">
          v8
        </Txt>
      </Metadata.Item>
      <Metadata.Item>
        <Txt as="span" variant="caption" tone="muted">
          Nov 3, 2026, 10:24 AM
        </Txt>
      </Metadata.Item>
      <Metadata.Item>
        <Txt as="span" variant="caption" tone="muted">
          (current)
        </Txt>
      </Metadata.Item>
    </Metadata>
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="max-w-60">
      <Metadata>
        <Metadata.Item>
          <Txt as="span" variant="label">
            Production
          </Txt>
        </Metadata.Item>
        <Metadata.Item>
          <Badge variant="success" size="xs">
            Connected
          </Badge>
        </Metadata.Item>
        <Metadata.Item>
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            damien-schneider-platform-infrastructure-and-customer-support
          </Txt>
        </Metadata.Item>
      </Metadata>
    </div>
  ),
};

export const SingleLine: Story = {
  render: () => (
    <div className="flex w-72 max-w-full min-w-0 flex-col">
      <Txt as="span" variant="meta" tone="muted">
        <Metadata singleLine>
          <Metadata.Item className="shrink-0">#42</Metadata.Item>
          <Metadata.Item>CustomerSupportSubscriptionRefundPolicyV2026InternationalEnterprise</Metadata.Item>
          <Metadata.Item className="shrink-0">3 hours ago</Metadata.Item>
        </Metadata>
      </Txt>
    </div>
  ),
};
