import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextAndIcon } from './text-and-icon';
import { IconCalendar1 } from '@/ds/icons/central/IconCalendar1';
import { IconCall } from '@/ds/icons/central/IconCall';
import { IconClock } from '@/ds/icons/central/IconClock';
import { IconEmail1 } from '@/ds/icons/central/IconEmail1';
import { IconMapPin } from '@/ds/icons/central/IconMapPin';
import { IconUser } from '@/ds/icons/central/IconUser';

const meta: Meta<typeof TextAndIcon> = {
  title: 'DataDisplay/TextAndIcon',
  component: TextAndIcon,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof TextAndIcon>;

export const Default: Story = {
  args: {
    children: (
      <>
        <IconClock />5 minutes ago
      </>
    ),
  },
};

export const WithUser: Story = {
  args: {
    children: (
      <>
        <IconUser />
        John Doe
      </>
    ),
  },
};

export const WithLocation: Story = {
  args: {
    children: (
      <>
        <IconMapPin />
        San Francisco, CA
      </>
    ),
  },
};

export const WithEmail: Story = {
  args: {
    children: (
      <>
        <IconEmail1 />
        hello@example.com
      </>
    ),
  },
};

export const AllExamples: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <TextAndIcon>
        <IconUser />
        John Doe
      </TextAndIcon>
      <TextAndIcon>
        <IconEmail1 />
        john@example.com
      </TextAndIcon>
      <TextAndIcon>
        <IconCall />
        +1 (555) 123-4567
      </TextAndIcon>
      <TextAndIcon>
        <IconMapPin />
        San Francisco, CA
      </TextAndIcon>
      <TextAndIcon>
        <IconCalendar1 />
        January 14, 2026
      </TextAndIcon>
      <TextAndIcon>
        <IconClock />
        Last updated 5 minutes ago
      </TextAndIcon>
    </div>
  ),
};

export const CustomClassName: Story = {
  args: {
    className: 'text-success-indicator',
    children: (
      <>
        <IconClock />
        Custom styled text
      </>
    ),
  },
};
