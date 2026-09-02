import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bot, Calculator, Calendar, CreditCard, GitBranch, Rocket, Settings, Shield, Smile, User } from 'lucide-react';
import * as React from 'react';

import { Button } from '../Button';
import { Kbd } from '../Kbd';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command';

const meta: Meta<typeof Command> = {
  title: 'Composite/Command',
  component: Command,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Command>;

const iconClassName = 'shrink-0 text-(--text-secondary)';

const InlineResult = ({
  icon,
  title,
  subtitle,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
}) => (
  <CommandItem value={value} className="h-auto items-start gap-3 px-2.5 py-2">
    <span className="bg-surface-active mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-(--text-primary)">
      {icon}
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-ui-sm leading-ui-sm truncate font-medium text-(--text-primary)">{title}</span>
      <span className="text-ui-xs leading-ui-xs truncate text-(--text-secondary)">{subtitle}</span>
    </span>
  </CommandItem>
);

export const Default: Story = {
  render: () => (
    <Command className="shadow-elevated w-100 rounded-lg border border-(--border-subtle)">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <Calendar className={iconClassName} />
            <span>Calendar</span>
          </CommandItem>
          <CommandItem>
            <Smile className={iconClassName} />
            <span>Search Emoji</span>
          </CommandItem>
          <CommandItem>
            <Calculator className={iconClassName} />
            <span>Calculator</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            <User className={iconClassName} />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <CreditCard className={iconClassName} />
            <span>Billing</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Settings className={iconClassName} />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const InlineVercelStyle: Story = {
  render: () => (
    <div className="bg-surface-secondary shadow-dialog w-sm overflow-hidden rounded-xl border border-(--border-subtle)">
      <Command className="bg-surface-secondary rounded-none">
        <CommandInput
          placeholder="Find..."
          rightSlot={
            <Kbd className="bg-surface-hover min-w-0 rounded border-(--border-subtle) px-1.5 py-0 text-[10px] leading-4 text-(--text-primary)">
              Esc
            </Kbd>
          }
        />
        <CommandList
          scrollArea
          scrollAreaClassName="max-h-[22rem]"
          scrollAreaViewportClassName="rounded-[inherit]"
          className="p-1.5"
        >
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Projects">
            <InlineResult
              icon={<Settings className="size-3.5" />}
              title="Settings"
              subtitle="Mastra"
              value="settings mastra account billing"
            />
            <InlineResult
              icon={<Rocket className="size-3.5" />}
              title="mastra-cloud-admin"
              subtitle="Project"
              value="mastra cloud admin project"
            />
            <InlineResult
              icon={<GitBranch className="size-3.5" />}
              title="codex/eu-residency-ux-plan"
              subtitle="platform-admin-portal"
              value="codex eu residency ux plan platform admin portal"
            />
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Commands">
            <InlineResult
              icon={<Shield className="size-3.5" />}
              title="Deployments"
              subtitle="mastra-docs-1.x"
              value="deployments mastra docs"
            />
            <InlineResult
              icon={<Settings className="size-3.5" />}
              title="On-Demand Concurrent Builds"
              subtitle="Mastra / Build and Deployment / Settings"
              value="on demand concurrent builds mastra build deployment settings"
            />
            <InlineResult
              icon={<Bot className="size-3.5" />}
              title="Navigation Assistant"
              subtitle="Search projects, routes, and commands"
              value="navigation assistant search projects routes commands"
            />
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
};

export const WithDialog: Story = {
  render: function WithDialogStory() {
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
      const down = (e: KeyboardEvent) => {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setOpen(open => !open);
        }
      };
      document.addEventListener('keydown', down);
      return () => document.removeEventListener('keydown', down);
    }, []);

    return (
      <>
        <p className="mb-4 text-sm text-(--text-secondary)">
          Press{' '}
          <kbd className="bg-surface-hover pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-(--border-subtle) px-1.5 font-mono text-[10px] font-medium text-(--text-primary) select-none">
            <span className="text-xs">⌘</span>K
          </kbd>{' '}
          or click the button below
        </p>
        <Button onClick={() => setOpen(true)}>Open Command Palette</Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem onSelect={() => setOpen(false)}>
                <Calendar className={iconClassName} />
                <span>Calendar</span>
              </CommandItem>
              <CommandItem onSelect={() => setOpen(false)}>
                <Smile className={iconClassName} />
                <span>Search Emoji</span>
              </CommandItem>
              <CommandItem onSelect={() => setOpen(false)}>
                <Calculator className={iconClassName} />
                <span>Calculator</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem onSelect={() => setOpen(false)}>
                <User className={iconClassName} />
                <span>Profile</span>
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => setOpen(false)}>
                <CreditCard className={iconClassName} />
                <span>Billing</span>
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => setOpen(false)}>
                <Settings className={iconClassName} />
                <span>Settings</span>
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <Command className="shadow-elevated w-100 rounded-lg border border-(--border-subtle)">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
    </Command>
  ),
};

export const WithShortcuts: Story = {
  render: () => (
    <Command className="shadow-elevated w-100 rounded-lg border border-(--border-subtle)">
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>
            <span>New File</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Open File</span>
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Save</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Save As...</span>
            <CommandShortcut>⇧⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Edit">
          <CommandItem>
            <span>Undo</span>
            <CommandShortcut>⌘Z</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Redo</span>
            <CommandShortcut>⇧⌘Z</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Cut</span>
            <CommandShortcut>⌘X</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Copy</span>
            <CommandShortcut>⌘C</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Paste</span>
            <CommandShortcut>⌘V</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const SearchOnly: Story = {
  render: function SearchOnlyStory() {
    const [search, setSearch] = React.useState('');

    const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew'];

    const filteredItems = items.filter(item => item.toLowerCase().includes(search.toLowerCase()));

    return (
      <Command className="shadow-elevated w-100 rounded-lg border border-(--border-subtle)">
        <CommandInput placeholder="Search fruits..." value={search} onValueChange={setSearch} />
        <CommandList>
          <CommandEmpty>No fruits found.</CommandEmpty>
          <CommandGroup heading="Fruits">
            {filteredItems.map(item => (
              <CommandItem key={item}>
                <span>{item}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  },
};
