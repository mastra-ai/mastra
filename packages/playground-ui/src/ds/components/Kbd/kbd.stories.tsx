import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './kbd';
import { KeyLabel } from './key-label';
import { keySymbols } from './key-symbols';
import { CommandShortcut } from '@/ds/components/Command';

const meta: Meta<typeof Kbd> = {
  title: 'Elements/Kbd',
  component: Kbd,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['default', 'sm', 'xs'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Kbd>;

export const Default: Story = {
  args: {
    children: 'K',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Kbd size="default">K</Kbd>
      <Kbd size="sm">K</Kbd>
      <Kbd size="xs">K</Kbd>
    </div>
  ),
};

export const ModifierKey: Story = {
  args: {
    children: 'Ctrl',
  },
};

export const KeyCombination: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <Kbd>Ctrl</Kbd>
      <span className="text-muted-foreground">+</span>
      <Kbd>K</Kbd>
    </div>
  ),
};

export const CommonShortcuts: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-muted-foreground">+</span>
          <Kbd>C</Kbd>
        </div>
        <span className="text-foreground">Copy</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-muted-foreground">+</span>
          <Kbd>V</Kbd>
        </div>
        <span className="text-foreground">Paste</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-muted-foreground">+</span>
          <Kbd>Z</Kbd>
        </div>
        <span className="text-foreground">Undo</span>
      </div>
    </div>
  ),
};

const symbols = Object.keys(keySymbols);
const sizes = ['default', 'sm', 'xs'] as const;
const pairs = [
  '⌘K',
  '⌘ K',
  '⌘L',
  '⌘W',
  '⌘[',
  '⇧⌘',
  '⌘↵',
  '⇧⌘P',
  '⇧ ⌘ P',
  'G K',
  'W M',
  'L I',
  'Ctrl K',
  'Ctrl ↵',
  '⌘Enter',
  'Shift Enter',
  'Esc',
  'K',
  '[',
];

const Shortcuts = ({ labels }: { labels: string[] }) => (
  <div className="flex flex-col gap-4">
    {sizes.map(size => (
      <div key={size} className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-caption text-muted-foreground">{size}</span>
        {labels.map(label => (
          <Kbd key={label} size={size}>
            {label}
          </Kbd>
        ))}
      </div>
    ))}
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-16 text-caption text-muted-foreground">text</span>
      {labels.map(label => (
        <CommandShortcut key={label} className="ml-0">
          {label}
        </CommandShortcut>
      ))}
    </div>
    <div className="flex [zoom:4] flex-wrap gap-x-1.5 gap-y-1">
      {labels.map(label => (
        <span
          key={label}
          className="relative inline-flex bg-card px-1.5 py-2 font-mono text-caption leading-none [font-size-adjust:none]"
        >
          <span className="relative [text-box:trim-both_cap_alphabetic] [word-spacing:-0.3em]">
            <span aria-hidden className="absolute inset-0 border-y-[0.25px] border-destructive-indicator" />
            <KeyLabel>{label}</KeyLabel>
          </span>
        </span>
      ))}
    </div>
  </div>
);

// Every symbol beside a letter. The magnified row's lines are the letters' cap height and baseline.
export const Symbols: Story = {
  parameters: { layout: 'padded' },
  render: () => <Shortcuts labels={symbols.map(symbol => `${symbol}K`)} />,
};

// Every kind of pair, to compare the gaps.
export const Pairs: Story = {
  parameters: { layout: 'padded' },
  render: () => <Shortcuts labels={pairs} />,
};
