import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BarChart3,
  Bot,
  Box,
  Calculator,
  Calendar,
  CreditCard,
  Folder,
  GitBranch,
  LifeBuoy,
  ListTree,
  MessageSquare,
  Rocket,
  Settings,
  Shield,
  Smile,
  User,
  Wrench,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '../Badge';
import { Button } from '../Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../Dialog';
import { Kbd } from '../Kbd';
import { Txt } from '../Txt';
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

const iconClassName = 'shrink-0 text-muted-foreground';

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
  <CommandItem value={value} className="group h-auto items-start gap-3 px-2.5 py-2">
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground group-data-[selected=true]:text-foreground [&>svg]:size-4">
      {icon}
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-column text-foreground">{title}</span>
      <span className="truncate text-meta text-muted-foreground">{subtitle}</span>
    </span>
  </CommandItem>
);

export const Default: Story = {
  render: () => (
    <Command className="w-100 rounded-lg shadow-raised">
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
    <div className="w-sm overflow-hidden rounded-xl bg-card shadow-raised">
      <Command className="rounded-none bg-background">
        <CommandInput
          placeholder="Find..."
          rightSlot={<Kbd className="min-w-0 rounded bg-muted px-1.5 py-0 text-meta text-muted-foreground">Esc</Kbd>}
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
        <p className="mb-4 text-body text-muted-foreground">
          Press{' '}
          <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-meta text-foreground select-none">
            <span className="text-caption">⌘</span>K
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
    <Command className="w-100 rounded-lg shadow-raised">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
    </Command>
  ),
};

export const WithShortcuts: Story = {
  render: () => (
    <Command className="w-100 rounded-lg shadow-raised">
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
      <Command className="w-100 rounded-lg shadow-raised">
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

export const InDialogWithDisabledRows: Story = {
  render: function InDialogWithDisabledRowsStory() {
    const [picked, setPicked] = React.useState('Nothing yet');

    return (
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add connection</DialogTitle>
          </DialogHeader>
          <Command loop label="Integrations">
            <CommandInput placeholder="Search integrations" />
            <CommandList className="p-2">
              <CommandGroup heading="Available">
                {['Slack', 'GitHub', 'Linear'].map(name => (
                  <CommandItem key={name} onSelect={() => setPicked(name)}>
                    <Calendar className={iconClassName} />
                    <span className="flex-1">{name}</span>
                    <Badge size="sm" variant="purple" icon={<Wrench />}>
                      Tools
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Coming soon">
                {['HubSpot', 'Discord'].map(name => (
                  <CommandItem key={name} disabled onSelect={() => setPicked(name)}>
                    <MessageSquare className={iconClassName} />
                    <span className="flex-1">{name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <Txt as="p" variant="caption" tone="muted" className="px-4 pb-4">
            Picked: {picked}
          </Txt>
        </DialogContent>
      </Dialog>
    );
  },
};

const InsetFooter = () => (
  <>
    <Button variant="ghost" size="sm" icon={<MessageSquare />}>
      Send feedback
    </Button>
    <span className="flex items-center gap-1.5">
      <Kbd size="sm">↑</Kbd>
      <Kbd size="sm">↓</Kbd>
      <Kbd size="sm">↵</Kbd>
      <Kbd size="sm">Esc</Kbd>
    </span>
  </>
);

const InsetResults = ({ search }: { search: string }) => (
  <CommandList scrollArea scrollAreaViewportClassName="max-h-dropdown">
    <CommandEmpty>No pages, projects, or commands match.</CommandEmpty>
    <CommandGroup heading="Observability">
      <CommandItem>
        <BarChart3 />
        Metrics
      </CommandItem>
      <CommandItem>
        <ListTree />
        Traces
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="Infrastructure">
      <CommandItem>
        <Box />
        Deploys
      </CommandItem>
      <CommandItem>
        <Settings />
        Settings
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="Projects">
      <CommandItem>
        <Folder />
        Support agent
        <CommandShortcut>Current</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <Folder />
        Research workflow
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="Help" forceMount={search.length > 0}>
      {search && (
        <CommandItem forceMount value={`ask ai ${search}`}>
          <Bot />
          Ask AI: “{search}”<CommandShortcut>⌘ ↵</CommandShortcut>
        </CommandItem>
      )}
      <CommandItem forceMount={search.length > 0} value="help contact support">
        <LifeBuoy />
        Contact support
      </CommandItem>
    </CommandGroup>
  </CommandList>
);

const InsetStory = ({ initialSearch }: { initialSearch: string }) => {
  const [open, setOpen] = React.useState(true);
  const [search, setSearch] = React.useState(initialSearch);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open command menu</Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        variant="inset"
        size="lg"
        showOverlay
        footer={<InsetFooter />}
        title="Search"
        description="Go to a page, switch projects, or run a command."
        commandLabel="Search pages, projects, and commands"
      >
        <CommandInput placeholder="Search pages, projects, and commands" value={search} onValueChange={setSearch} />
        <InsetResults search={search.trim()} />
      </CommandDialog>
    </>
  );
};

export const Inset: Story = {
  render: () => <InsetStory initialSearch="" />,
};

export const InsetFiltered: Story = {
  render: () => <InsetStory initialSearch="trace" />,
};

export const InsetNoResults: Story = {
  render: () => <InsetStory initialSearch="how do I add memory" />,
};
