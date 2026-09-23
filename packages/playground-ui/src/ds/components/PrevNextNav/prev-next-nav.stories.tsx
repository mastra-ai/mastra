import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { PrevNextNav } from './prev-next-nav';

const meta: Meta<typeof PrevNextNav> = {
  title: 'Navigation/PrevNextNav',
  component: PrevNextNav,
  parameters: { layout: 'centered' },
  args: {
    onPrevious: fn(),
    onNext: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PrevNextNav>;

export const BetweenItems: Story = {};

export const FirstItem: Story = {
  args: { onPrevious: undefined },
};

export const LastItem: Story = {
  args: { onNext: undefined },
};
