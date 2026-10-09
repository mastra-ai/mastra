import type { Meta, StoryObj } from '@storybook/react-vite';
import { BookOpenIcon } from 'lucide-react';
import { Txt } from '../Txt';
import { TextLink } from './text-link';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const meta: Meta<typeof TextLink> = {
  title: 'Elements/TextLink',
  component: TextLink,
  parameters: {
    layout: 'centered',
  },
  args: {
    href: '#',
    children: 'View usage',
  },
  decorators: [
    Story => (
      <Txt as="p" variant="label">
        <Story />
      </Txt>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TextLink>;

export const Default: Story = {};

export const InheritsTextStyle: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      {(['meta', 'caption', 'label', 'body'] as const).map(variant => (
        <Txt key={variant} as="p" variant={variant}>
          <TextLink href="#">View all</TextLink>
        </Txt>
      ))}
    </div>
  ),
};

export const External: Story = {
  args: {
    href: 'https://mastra.ai',
    target: '_blank',
    rel: 'noopener noreferrer',
    children: 'Open billing portal',
  },
};

export const CustomIcon: Story = {
  args: {
    icon: <BookOpenIcon aria-hidden />,
    children: 'Docs',
  },
};

export const WithoutIcon: Story = {
  args: {
    icon: false,
    children: 'View all',
  },
};

export const InSectionHeader: Story = {
  render: () => (
    <div className="flex w-120 flex-col gap-6">
      {[
        ['Usage this month', 'View usage'],
        ['Production projects', 'View projects'],
        ['Credit history', 'Open billing portal'],
      ].map(([title, label]) => (
        <div key={title} className="flex items-center justify-between">
          <Txt as="span" variant="subheading">
            {title}
          </Txt>
          <TextLink href="#">{label}</TextLink>
        </div>
      ))}
    </div>
  ),
};

export const OnCard: Story = {
  render: () => (
    <div className={`flex w-120 items-center justify-between rounded-xl p-4 ${raisedSurfaceStyle}`}>
      <Txt as="span" variant="label">
        Supervisor
      </Txt>
      <Txt as="span" variant="meta">
        <TextLink href="#">View all</TextLink>
      </Txt>
    </div>
  ),
};
