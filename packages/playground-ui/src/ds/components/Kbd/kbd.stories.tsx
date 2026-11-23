import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './kbd';
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

// Every symbol between letters, at every size and in the plain text a menu or command row uses. The magnified
// row's red lines are the letters' cap height and baseline.
export const Symbols: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-6">
      {sizes.map(size => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-caption text-muted-foreground">{size}</span>
          {symbols.map(symbol => (
            <Kbd key={symbol} size={size}>
              {`${symbol}K`}
            </Kbd>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-caption text-muted-foreground">text</span>
        {symbols.map(symbol => (
          <CommandShortcut key={symbol} className="ml-0">{`${symbol}K`}</CommandShortcut>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-caption text-muted-foreground">gaps</span>
        {['⌘K', '⌘ K', '⇧⌘P', '⇧ ⌘ P', '⌘↵', 'Ctrl ↵', 'Ctrl K', 'Esc', 'Enter', '['].map(keys => (
          <Kbd key={keys}>{keys}</Kbd>
        ))}
      </div>
      <div className="flex [zoom:4] flex-wrap gap-x-2 gap-y-1">
        {symbols.map(symbol => (
          <span key={symbol} className="relative inline-flex bg-card px-1 py-2 font-mono text-caption leading-none">
            <span className="relative [text-box:trim-both_cap_alphabetic]">
              <span aria-hidden className="absolute inset-0 border-y-[0.25px] border-destructive-indicator" />
              <CommandShortcut className="font-[inherit] text-[length:inherit] tracking-normal text-foreground">
                {`H${symbol}K`}
              </CommandShortcut>
            </span>
          </span>
        ))}
      </div>
    </div>
  ),
};
