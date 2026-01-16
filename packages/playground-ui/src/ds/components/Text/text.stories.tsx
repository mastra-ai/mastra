import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextAndIcon } from './text-and-icon';
import { Clock, User, MapPin, Mail, Phone, Calendar } from 'lucide-react';

const meta: Meta<typeof TextAndIcon> = {
  title: 'DataDisplay/TextAndIcon',
  component: TextAndIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TextAndIcon>;

export const Default: Story = {
  args: {
    children: (
      <>
        <Clock />5 minutes ago
      </>
    ),
  },
};

export const WithUser: Story = {
  args: {
    children: (
      <>
        <User />
        John Doe
      </>
    ),
  },
};

export const WithLocation: Story = {
  args: {
    children: (
      <>
        <MapPin />
        San Francisco, CA
      </>
    ),
  },
};

export const WithEmail: Story = {
  args: {
    children: (
      <>
        <Mail />
        hello@example.com
      </>
    ),
  },
};

export const AllExamples: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <TextAndIcon>
        <User />
        John Doe
      </TextAndIcon>
      <TextAndIcon>
        <Mail />
        john@example.com
      </TextAndIcon>
      <TextAndIcon>
        <Phone />
        +1 (555) 123-4567
      </TextAndIcon>
      <TextAndIcon>
        <MapPin />
        San Francisco, CA
      </TextAndIcon>
      <TextAndIcon>
        <Calendar />
        January 14, 2026
      </TextAndIcon>
      <TextAndIcon>
        <Clock />
        Last updated 5 minutes ago
      </TextAndIcon>
    </div>
  ),
};

export const CustomClassName: Story = {
  args: {
    className: 'text-accent1',
    children: (
      <>
        <Clock />
        Custom styled text
      </>
    ),
  },
};
