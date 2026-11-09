import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, FieldLabel } from '../Field';
import { TimeInput } from './time-input';

const meta: Meta<typeof TimeInput> = {
  title: 'Elements/TimeInput',
  component: TimeInput,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TimeInput>;

export const Default: Story = {
  args: {
    defaultValue: '12:00',
    'aria-label': 'Time',
    className: 'w-40',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <TimeInput size="sm" defaultValue="12:00" aria-label="Small" className="w-40" />
      <TimeInput size="md" defaultValue="12:00" aria-label="Medium" className="w-40" />
      <TimeInput size="lg" defaultValue="12:00" aria-label="Large" className="w-40" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    defaultValue: '12:00',
    'aria-label': 'Time',
    className: 'w-40',
    disabled: true,
  },
};

export const WithField: Story = {
  render: () => (
    <Field className="w-40">
      <FieldLabel>Start time</FieldLabel>
      <TimeInput defaultValue="09:30" />
    </Field>
  ),
};

/** At w-24 the clock still fits next to "12:00 AM"; any narrower and it hides. */
export const NarrowWidths: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <TimeInput size="sm" defaultValue="00:00" aria-label="w-24" className="w-24" />
      <TimeInput size="sm" defaultValue="00:00" aria-label="w-20" className="w-20" />
    </div>
  ),
};
