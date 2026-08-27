import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrainIcon, MessagesSquareIcon } from 'lucide-react';

import { TokenBudget } from './token-budget';
import { TokenBudgetDetail } from './token-budget-detail';

const meta: Meta<typeof TokenBudget> = {
  title: 'DataDisplay/TokenBudget',
  component: TokenBudget,
  parameters: { layout: 'centered' },
  args: {
    label: 'Message window',
    tokens: 14_900,
    threshold: 30_000,
    tone: 'messages',
    working: false,
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['messages', 'memory', 'warning'] },
  },
};

export default meta;
type Story = StoryObj<typeof TokenBudget>;

export const Default: Story = {};

export const Budgets: Story = {
  render: () => (
    <div className="border-border1 bg-surface2 flex items-center gap-5 rounded-xl border p-4">
      <TokenBudget label="Messages" tokens={5_200} threshold={8_000} tone="messages" />
      <TokenBudget label="Observations" tokens={7_200} threshold={8_000} tone="warning" />
      <TokenBudget label="Memory" tokens={1_200} threshold={8_000} tone="memory" working />
    </div>
  ),
};

export const Details: Story = {
  render: () => (
    <div className="border-border1 bg-surface2 grid w-112 gap-5 rounded-xl border p-5">
      <TokenBudgetDetail
        icon={<MessagesSquareIcon />}
        label="Messages"
        tokens={5_200}
        threshold={8_000}
        projected={2_000}
        description="Compaction starts when this window fills."
      />
      <TokenBudgetDetail
        icon={<BrainIcon />}
        label="Observations"
        tokens={1_900}
        threshold={8_000}
        tone="memory"
        description="New observations replace older working context."
      />
    </div>
  ),
};
