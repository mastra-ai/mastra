import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../Button';
import { CommandEmpty, CommandGroup } from '../Command';
import {
  CommandPaletteBody,
  CommandPaletteDialog,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteRail,
  CommandPaletteResults,
  CommandPaletteScope,
} from './command-palette';
import { IconDirection1 } from '@/ds/icons/central/IconDirection1';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';
import { IconRobot } from '@/ds/icons/central/IconRobot';
import { IconSettingsGear1 } from '@/ds/icons/central/IconSettingsGear1';

const meta = {
  title: 'Composite/CommandPalette',
  component: CommandPaletteDialog,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CommandPaletteDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

type ExampleScope = 'all' | 'navigation' | 'agents';

function CommandPaletteExample() {
  const [open, setOpen] = useState(true);
  const [scope, setScope] = useState<ExampleScope>('all');
  const showNavigation = scope === 'all' || scope === 'navigation';
  const showAgents = scope === 'all' || scope === 'agents';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-sidebar">
      <Button onClick={() => setOpen(true)}>Open command palette</Button>
      <CommandPaletteDialog
        open={open}
        onOpenChange={setOpen}
        title="Application search"
        description="Search routes and application resources"
        commandLabel="Search resources"
      >
        <CommandPaletteInput placeholder="Search routes and resources" />
        <CommandPaletteBody>
          <CommandPaletteRail aria-label="Search categories">
            <CommandPaletteScope
              icon={<IconMagnifyingGlass />}
              label="All"
              count={4}
              active={scope === 'all'}
              onSelect={() => setScope('all')}
            />
            <CommandPaletteScope
              icon={<IconDirection1 />}
              label="Navigation"
              count={2}
              active={scope === 'navigation'}
              onSelect={() => setScope('navigation')}
            />
            <CommandPaletteScope
              icon={<IconRobot />}
              label="Agents"
              count={2}
              active={scope === 'agents'}
              onSelect={() => setScope('agents')}
            />
          </CommandPaletteRail>
          <CommandPaletteResults
            aria-label="Search results"
            footer={<CommandPaletteFooter label="Application search" />}
          >
            <CommandEmpty>No matching results.</CommandEmpty>
            {showNavigation && (
              <CommandGroup heading="Navigation">
                <CommandPaletteItem
                  icon={<IconDirection1 />}
                  title="Overview"
                  subtitle="Application navigation"
                  path="/"
                  value="overview application navigation"
                />
                <CommandPaletteItem
                  icon={<IconSettingsGear1 />}
                  title="Settings"
                  subtitle="Application navigation"
                  path="/settings"
                  value="settings application navigation"
                />
              </CommandGroup>
            )}
            {showAgents && (
              <CommandGroup heading="Agents">
                <CommandPaletteItem
                  icon={<IconRobot />}
                  title="Weather Agent"
                  subtitle="Agent"
                  badge="Agent"
                  value="weather agent"
                />
                <CommandPaletteItem
                  icon={<IconRobot />}
                  title="Research Agent"
                  subtitle="Agent"
                  badge="Agent"
                  value="research agent"
                />
              </CommandGroup>
            )}
          </CommandPaletteResults>
        </CommandPaletteBody>
      </CommandPaletteDialog>
    </div>
  );
}

export const Default: Story = {
  render: () => <CommandPaletteExample />,
};
