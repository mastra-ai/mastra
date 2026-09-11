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
  },
};

export const HeaderMd: Story = {
  args: {
    children: 'Header Medium',
    variant: 'header-md',
    as: 'h2',
  },
};

export const UiLg: Story = {
  args: {
    children: 'UI Large text',
    variant: 'ui-lg',
  },
};

export const UiMd: Story = {
  args: {
    children: 'UI Medium text',
    variant: 'ui-md',
  },
};

export const UiSm: Story = {
  args: {
    children: 'UI Small text',
    variant: 'ui-sm',
  },
};

export const UiXs: Story = {
  args: {
    children: 'UI Extra Small text',
    variant: 'ui-xs',
  },
};

export const Monospace: Story = {
  args: {
    children: 'const code = "monospace"',
    variant: 'ui-md',
    font: 'mono',
  },
};

export const AsHeading: Story = {
  args: {
    children: 'This is a heading',
    as: 'h1',
    variant: 'header-md',
  },
};

export const AsLabel: Story = {
  args: {
    children: 'Form Label',
    as: 'label',
    variant: 'ui-sm',
    htmlFor: 'input-field',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Txt variant="header-md" as="h2">
        Header Medium
      </Txt>
      <Txt variant="ui-lg">UI Large</Txt>
      <Txt variant="ui-md">UI Medium</Txt>
      <Txt variant="ui-sm">UI Small</Txt>
      <Txt variant="ui-xs">UI Extra Small</Txt>
    </div>
  ),
};

/**
 * Reference hierarchy used across Studio. Pick the variant by role, not by
 * eyeballing size: page title → header-md, onboarding hero → header-xl,
 * section → header-sm, panel subtitle → ui-md medium, body → ui-md,
 * secondary → ui-sm, meta/badges → ui-xs. Never use ui-xs/ui-sm for headings.
 */
export const Hierarchy: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <Txt as="h1" variant="header-xl" className="text-neutral6 font-semibold">
        Hero title (header-xl) — onboarding only
      </Txt>
      <Txt as="h1" variant="header-md" className="text-neutral6 font-medium">
        Page title (header-md)
      </Txt>
      <Txt as="h2" variant="header-sm" className="text-neutral6 font-medium">
        Section title (header-sm)
      </Txt>
      <Txt as="h3" variant="ui-md" className="text-neutral5 font-medium">
        Panel subtitle (ui-md, medium)
      </Txt>
      <Txt as="p" variant="ui-md" className="text-neutral4">
        Body copy (ui-md). The paired line-height comes with the token; do not add leading-* utilities.
      </Txt>
      <Txt as="p" variant="ui-sm" className="text-neutral3">
        Secondary text (ui-sm) for helper copy and descriptions.
      </Txt>
      <Txt as="span" variant="ui-xs" className="text-neutral3 tracking-wide uppercase">
        Meta / badge (ui-xs)
      </Txt>
    </div>
  ),
};

export const MonospaceVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Txt variant="ui-md" font="mono">
        Regular monospace
      </Txt>
      <Txt variant="ui-sm" font="mono">
        Small monospace
      </Txt>
      <Txt variant="ui-xs" font="mono">
        Extra small monospace
      </Txt>
    </div>
  ),
};
