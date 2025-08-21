import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { ArrowRightIcon, DownloadIcon, SettingsIcon } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Elements/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'outline', 'ghost'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Primary: Story = {
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};

export const Outline: Story = {
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    children: 'Outline Button (Default)',
    variant: 'outline',
  },
};

export const Ghost: Story = {
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
};

export const WithIcon: Story = {
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    children: (
      <>
        Download
        <DownloadIcon />
      </>
    ),
    variant: 'primary',
  },
};

export const IconOnly: Story = {
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    children: <SettingsIcon />,
    variant: 'ghost',
    'aria-label': 'Settingss',
  },
};

export const Disabled: Story = {
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
};

export const AsLink: Story = {
  args: {
    children: 'Link Button - Outline',
    as: 'a',
    href: '#',
    variant: 'outline',
  },
};
