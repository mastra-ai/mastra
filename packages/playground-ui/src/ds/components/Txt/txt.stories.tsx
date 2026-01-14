import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from './Txt';

const meta: Meta<typeof Txt> = {
  title: 'Elements/Txt',
  component: Txt,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    as: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'],
    },
    variant: {
      control: { type: 'select' },
      options: ['header-md', 'ui-lg', 'ui-md', 'ui-sm', 'ui-xs'],
    },
    font: {
      control: { type: 'select' },
      options: [undefined, 'mono'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Txt>;

export const Default: Story = {
  args: {
    children: 'Default text',
    variant: 'ui-md',
    className: 'text-neutral6',
  },
};

export const HeaderMd: Story = {
  args: {
    children: 'Header Medium',
    variant: 'header-md',
    as: 'h2',
    className: 'text-neutral6',
  },
};

export const UiLg: Story = {
  args: {
    children: 'UI Large text',
    variant: 'ui-lg',
    className: 'text-neutral6',
  },
};

export const UiMd: Story = {
  args: {
    children: 'UI Medium text',
    variant: 'ui-md',
    className: 'text-neutral6',
  },
};

export const UiSm: Story = {
  args: {
    children: 'UI Small text',
    variant: 'ui-sm',
    className: 'text-neutral6',
  },
};

export const UiXs: Story = {
  args: {
    children: 'UI Extra Small text',
    variant: 'ui-xs',
    className: 'text-neutral6',
  },
};

export const Monospace: Story = {
  args: {
    children: 'const code = "monospace"',
    variant: 'ui-md',
    font: 'mono',
    className: 'text-neutral6',
  },
};

export const AsHeading: Story = {
  args: {
    children: 'This is a heading',
    as: 'h1',
    variant: 'header-md',
    className: 'text-neutral6',
  },
};

export const AsLabel: Story = {
  args: {
    children: 'Form Label',
    as: 'label',
    variant: 'ui-sm',
    htmlFor: 'input-field',
    className: 'text-neutral6',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Txt variant="header-md" as="h2" className="text-neutral6">
        Header Medium
      </Txt>
      <Txt variant="ui-lg" className="text-neutral6">
        UI Large
      </Txt>
      <Txt variant="ui-md" className="text-neutral6">
        UI Medium
      </Txt>
      <Txt variant="ui-sm" className="text-neutral6">
        UI Small
      </Txt>
      <Txt variant="ui-xs" className="text-neutral6">
        UI Extra Small
      </Txt>
    </div>
  ),
};

export const MonospaceVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Txt variant="ui-md" font="mono" className="text-neutral6">
        Regular monospace
      </Txt>
      <Txt variant="ui-sm" font="mono" className="text-neutral6">
        Small monospace
      </Txt>
      <Txt variant="ui-xs" font="mono" className="text-neutral6">
        Extra small monospace
      </Txt>
    </div>
  ),
};
