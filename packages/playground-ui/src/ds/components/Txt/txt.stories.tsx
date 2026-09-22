import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from './Txt';

const meta: Meta<typeof Txt> = {
  title: 'Elements/Txt',
  component: Txt,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    as: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'],
    },
    variant: {
      control: { type: 'select' },
      options: ['display', 'title', 'heading', 'subheading', 'body', 'label', 'body-sm', 'column', 'caption', 'meta'],
    },
    tone: {
      control: { type: 'select' },
      options: [undefined, 'ink', 'muted', 'faint'],
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
    children: 'The quick brown fox jumps over the lazy dog',
  },
};

/**
 * One class per role: the weight and line height are part of the role, so two
 * components asking for the same role cannot disagree about how it looks.
 */
export const Roles: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Txt as="h1" variant="display">
        display · 22/500 · onboarding hero
      </Txt>
      <Txt as="h1" variant="title">
        title · 18/500 · page title
      </Txt>
      <Txt as="h2" variant="heading">
        heading · 16/500 · page and panel headings
      </Txt>
      <Txt as="h3" variant="subheading">
        subheading · 14/500 · sections and cards
      </Txt>
      <Txt variant="body">body · 14/400 · prose and descriptions</Txt>
      <Txt variant="label">label · 13/500 · control labels, nav items, buttons</Txt>
      <Txt variant="body-sm">body-sm · 13/400 · table cells, menus, field values</Txt>
      <Txt variant="column">column · 12/500 · column headers</Txt>
      <Txt variant="caption">caption · 12/400 · secondary copy</Txt>
      <Txt variant="meta">meta · 10/500 · badges and keycaps</Txt>
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Txt variant="body-sm" tone="ink">
        Ink — the reading tone, inherited by default and written only to lift text back out of a muted block
      </Txt>
      <Txt variant="body-sm" tone="muted">
        Muted — supporting copy
      </Txt>
      <Txt variant="body-sm" tone="faint">
        Faint — placeholders and absent values
      </Txt>
    </div>
  ),
};

export const Monospace: Story = {
  args: {
    children: 'const code = "monospace"',
    variant: 'body-sm',
    font: 'mono',
  },
};

export const AsLabel: Story = {
  args: {
    children: 'Form label',
    as: 'label',
    variant: 'label',
    htmlFor: 'input-field',
  },
};
