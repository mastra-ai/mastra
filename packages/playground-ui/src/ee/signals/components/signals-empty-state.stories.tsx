import type { Meta, StoryObj } from '@storybook/react-vite';

import { SignalsEmptyState } from './signals-empty-state';

const meta = {
  title: 'Domains/Signals/Empty State',
  component: SignalsEmptyState,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignalsEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collecting: Story = {};
export const EmptyDateRange: Story = { args: { isRangeEmpty: true } };
