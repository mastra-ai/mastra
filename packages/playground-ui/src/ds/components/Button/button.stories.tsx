import type { Meta, StoryObj } from '@storybook/react-vite';
import { Fragment, useState } from 'react';
import { Input } from '../Input';
import { TooltipProvider } from '../Tooltip';
import { Txt } from '../Txt';
import type { ButtonVariant } from './Button';
import { Button } from './Button';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { IconSettingsGear5 } from '@/ds/icons/central/IconSettingsGear5';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const ALL_VARIANTS: ButtonVariant[] = [
  'default',
  'primary',
  'destructive',
  'destructive-ghost',
  'ghost',
  'subtle',
  'link',
];

const meta: Meta<typeof Button> = {
  title: 'Elements/Button',
  component: Button,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ALL_VARIANTS,
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'icon-sm', 'icon-md', 'icon-lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    loading: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    size: 'md',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {ALL_VARIANTS.map(variant => (
        <Button key={variant} variant={variant} render={variant === 'link' ? <a href="#" /> : undefined}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {ALL_VARIANTS.map(variant => (
        <Button key={variant} variant={variant} disabled render={variant === 'link' ? <a href="#" /> : undefined}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

// The rule: the loader takes the place of the icon, or goes on the left when there is none. The label
// stays, the button keeps focus, and its clicks do nothing. Pass only `loading`.
export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Pass `loading` to the button whose action is in progress. The loader takes the place of the icon (`icon`, else `iconEnd`, else the glyph of an icon-only button); a button without an icon gets it on the left. The label and the button's colours stay, clicks do nothing, focus stays on the button, and the loader waits 150ms so a quick action changes nothing on screen.",
      },
    },
  },
  render: () => (
    <div className="grid grid-cols-[8rem_repeat(6,max-content)] items-center gap-3">
      <span />
      {['idle', 'icon', 'no icon', 'trailing icon', 'icon only', 'disabled'].map(label => (
        <Txt key={label} as="span" variant="meta" tone="muted">
          {label}
        </Txt>
      ))}
      {ALL_VARIANTS.map(variant => (
        <Fragment key={variant}>
          <Txt as="span" variant="meta" tone="muted">
            {variant}
          </Txt>
          <Button variant={variant} icon={<IconPlusMedium />}>
            Create project
          </Button>
          <Button variant={variant} icon={<IconPlusMedium />} loading>
            Create project
          </Button>
          <Button variant={variant} loading>
            Create project
          </Button>
          <Button variant={variant} iconEnd={<IconArrowUpRight />} loading>
            Create project
          </Button>
          {variant === 'link' ? (
            <span />
          ) : (
            <Button variant={variant} size="icon-md" tooltip="Create project" loading>
              <IconPlusMedium />
            </Button>
          )}
          <Button variant={variant} icon={<IconPlusMedium />} disabled>
            Create project
          </Button>
        </Fragment>
      ))}
    </div>
  ),
};

export const LoadingSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['sm', 'md', 'lg'] as const).map(size => (
        <div key={size} className="flex items-center gap-4">
          <Button size={size} icon={<IconPlusMedium />}>
            Add item
          </Button>
          <Button size={size} icon={<IconPlusMedium />} loading>
            Add item
          </Button>
          <Button size={size} loading>
            Add item
          </Button>
          <Button size={`icon-${size}`} tooltip="Add item" loading>
            <IconPlusMedium />
          </Button>
        </div>
      ))}
    </div>
  ),
};

// Click to start: the button keeps focus, its tooltip still opens, and it ends after three seconds.
export const LoadingOnClick: Story = {
  render: function LoadingOnClickStory() {
    const [running, setRunning] = useState<string>();
    const run = (id: string) => ({
      loading: running === id,
      onClick: () => {
        setRunning(id);
        setTimeout(() => setRunning(undefined), 3000);
      },
    });
    return (
      <div className="flex items-center gap-4">
        <Button variant="primary" icon={<IconPlusMedium />} {...run('icon')}>
          Create project
        </Button>
        <Button {...run('label')}>Retry</Button>
        <Button variant="ghost" size="icon-md" tooltip="Delete" {...run('glyph')}>
          <TrashIcon />
        </Button>
        <Button
          {...run('instant')}
          onClick={() => {
            setRunning('instant');
            setTimeout(() => setRunning(undefined), 80);
          }}
        >
          Done in 80ms
        </Button>
      </div>
    );
  },
};

export const WithIcon: Story = {
  args: {
    icon: <IconPlusMedium />,
    children: 'Add Item',
  },
};

export const WithIconSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {(['sm', 'md', 'lg'] as const).map(size => (
          <Button key={size} size={size} icon={<IconPlusMedium />}>
            Add item
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {(['sm', 'md', 'lg'] as const).map(size => (
          <Button key={size} size={size} iconEnd={<IconArrowUpRight />}>
            Open portal
          </Button>
        ))}
      </div>
    </div>
  ),
};

export const WithTooltip: Story = {
  args: {
    children: 'Hover me',
    tooltip: 'I am a tooltip',
  },
};

// A button with only an icon takes the icon size of the same rung: same height as the
// labelled button beside it, but square, so it renders as a circle instead of a pill.
export const IconBesideText: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['sm', 'md', 'lg'] as const).map(size => (
        <div key={size} className="flex items-center gap-2">
          <Button size={size} icon={<IconPlusMedium />}>
            Add item
          </Button>
          <Button size={`icon-${size}`} tooltip="Settings">
            <IconSettingsGear5 />
          </Button>
          <Button size={`icon-${size}`} variant="ghost" tooltip="Delete">
            <TrashIcon />
          </Button>
        </div>
      ))}
    </div>
  ),
};

export const IconButtonDefault: Story = {
  args: {
    children: <IconSettingsGear5 />,
    tooltip: 'Settings',
    size: 'icon-md',
    variant: 'default',
  },
};

export const IconButtonVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {ALL_VARIANTS.filter(variant => variant !== 'link').map(variant => (
        <Button key={variant} size="icon-md" variant={variant} tooltip={variant}>
          <IconSettingsGear5 />
        </Button>
      ))}
    </div>
  ),
};

export const IconButtonSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="icon-sm" tooltip="Small">
        <IconSettingsGear5 />
      </Button>
      <Button size="icon-md" tooltip="Medium">
        <IconSettingsGear5 />
      </Button>
      <Button size="icon-lg" tooltip="Large">
        <IconSettingsGear5 />
      </Button>
    </div>
  ),
};

export const IconButtonDisabled: Story = {
  args: {
    children: <IconSettingsGear5 />,
    tooltip: 'Settings (disabled)',
    size: 'icon-md',
    disabled: true,
  },
};

export const VariantSizeMatrix: Story = {
  render: () => (
    <div className="grid grid-cols-[6rem_repeat(3,max-content)_max-content] items-center gap-3">
      <span />
      {['sm', 'default', 'lg', 'with icon'].map(label => (
        <Txt key={label} as="span" variant="meta" tone="muted" className="text-center">
          {label}
        </Txt>
      ))}
      {ALL_VARIANTS.map(variant => (
        <Fragment key={variant}>
          <Txt as="span" variant="meta" tone="muted">
            {variant}
          </Txt>
          <Button variant={variant} size="sm" render={variant === 'link' ? <a href="#" /> : undefined}>
            sm
          </Button>
          <Button variant={variant} size="md" render={variant === 'link' ? <a href="#" /> : undefined}>
            md
          </Button>
          <Button variant={variant} size="lg" render={variant === 'link' ? <a href="#" /> : undefined}>
            lg
          </Button>
          <Button
            icon={<TrashIcon />}
            variant={variant}
            size="lg"
            render={variant === 'link' ? <a href="#" /> : undefined}
          >
            with icon
          </Button>
        </Fragment>
      ))}
    </div>
  ),
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="flex w-[calc(100vw-2rem)] max-w-120 flex-col gap-4">
      <div className="rounded-lg border border-border bg-background p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Main canvas
        </Txt>
        <div className="flex gap-2">
          <Input aria-label="Agent name on the main canvas" placeholder="Agent name" />
          <Button>Rename</Button>
        </div>
      </div>
      <div className={`${raisedSurfaceStyle} rounded-lg p-4`}>
        <Txt variant="caption" tone="muted" className="mb-2">
          Card
        </Txt>
        <div className="flex gap-2">
          <Input aria-label="Agent name on a card" placeholder="Agent name" />
          <Button>Rename</Button>
        </div>
      </div>
    </div>
  ),
};

export const Link: Story = {
  render: () => (
    <div className="flex w-120 flex-col gap-6">
      <div className="flex items-center justify-between">
        <Txt as="span" variant="subheading">
          Usage this month
        </Txt>
        <Button variant="link" render={<a href="#" />}>
          View usage
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <Txt as="span" variant="subheading">
          Credit history
        </Txt>
        <Button
          variant="link"
          render={<a href="https://mastra.ai" target="_blank" rel="noopener noreferrer" />}
          iconEnd={<IconArrowUpRight />}
        >
          Open billing portal
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <Txt as="span" variant="subheading">
          Disabled
        </Txt>
        <Button variant="link" disabled render={<a href="#" />}>
          View usage
        </Button>
      </div>
    </div>
  ),
};

export const WithIconEnd: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(['default', 'ghost', 'primary'] as const).map(variant => (
        <Button key={variant} variant={variant} iconEnd={<IconArrowUpRight />}>
          Open portal
        </Button>
      ))}
    </div>
  ),
};
