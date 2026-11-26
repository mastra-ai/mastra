import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { CopyButton } from '../CopyButton';
import { EmptyState } from '../EmptyState';
import { Spinner } from '../Spinner';
import { StatusDot } from '../StatusIndicators';
import { Txt } from '../Txt';
import { sceneByName } from './art/scenes';
import type { EmptyStateArtName } from './art/scenes';
import { EmptyStateArt } from './empty-state-art';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';

const names = Object.keys(sceneByName).filter((name): name is EmptyStateArtName => name in sceneByName);

const meta: Meta<typeof EmptyStateArt> = {
  title: 'Feedback/EmptyStateArt',
  component: EmptyStateArt,
  parameters: { layout: 'centered' },
  args: { name: 'knowledge', state: 'idle' },
  argTypes: {
    name: { control: 'select', options: names },
    state: { control: 'inline-radio', options: ['idle', 'working', 'failed'] },
    hue: { control: 'select', options: [undefined, 'purple', 'blue', 'green', 'orange', 'pink', 'yellow'] },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyStateArt>;

export const Default: Story = {};

export const AllDrawings: Story = {
  parameters: { layout: 'fullscreen' },
  render: ({ state }) => (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3 xl:grid-cols-4">
      {names.map(name => (
        <div key={name} className="flex flex-col items-center gap-3 rounded-lg bg-card p-6">
          <EmptyStateArt name={name} state={state} />
          <Txt variant="caption" tone="muted">
            {name}
          </Txt>
        </div>
      ))}
    </div>
  ),
};

const knowledge = {
  layout: 'split',
  titleSlot: 'Give your agents shared knowledge',
  descriptionSlot:
    'A store of pages your agents search, read and write. Importers keep it in sync with Linear, Notion, Confluence, Zendesk and Fireflies.',
} as const;

export const CreateState: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <EmptyState
      {...knowledge}
      iconSlot={<EmptyStateArt name="knowledge" />}
      actionSlot={<Button variant="primary">Set up knowledge</Button>}
      statusSlot="Creates a dedicated Postgres database."
    />
  ),
};

export const SettingUp: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <EmptyState
      layout="split"
      titleSlot="Setting up knowledge"
      descriptionSlot="Creating a dedicated Postgres database for this project. This page updates when it’s ready."
      iconSlot={<EmptyStateArt name="knowledge" state="working" />}
      actionSlot={
        <Button icon={<Spinner />} variant="primary" disabled>
          Setting up
        </Button>
      }
    />
  ),
};

export const Failed: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <EmptyState
      layout="split"
      tone="error"
      titleSlot="Couldn’t set up knowledge"
      descriptionSlot="The Postgres database for this project didn’t start. Your project and its agents aren’t affected. Try again, or contact support if it keeps failing."
      iconSlot={<EmptyStateArt name="knowledge" state="failed" />}
      actionSlot={
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Try again</Button>
          <Button>Contact support</Button>
        </div>
      }
      statusSlot={
        <>
          Reference
          <Txt as="span" variant="caption" font="mono">
            kn_8f3a2c91
          </Txt>
          <CopyButton content="kn_8f3a2c91" tooltip="Copy reference" />
        </>
      }
    />
  ),
};

export const FailedYouCanFix: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <EmptyState
      layout="split"
      tone="error"
      titleSlot="Couldn’t create production"
      descriptionSlot="Your organization has reached its limit of 5 environments. Delete one you no longer use, or upgrade your plan to add more."
      iconSlot={<EmptyStateArt name="environments" state="failed" />}
      actionSlot={
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Manage environments</Button>
          <Button variant="link" iconEnd={<IconArrowUpRight />}>
            Environment limits
          </Button>
        </div>
      }
    />
  ),
};

export const Importing: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <EmptyState
      layout="split"
      titleSlot="Importing your first pages"
      descriptionSlot="Pages show up here as they land."
      iconSlot={<EmptyStateArt name="knowledge" state="working" />}
      actionSlot={
        <div className="flex items-center gap-3">
          <Button>View importer</Button>
          <Button variant="link" iconEnd={<IconArrowUpRight />}>
            How it works
          </Button>
        </div>
      }
      statusSlot={
        <>
          <StatusDot
            status="building"
            decorative
            presentation={() => ({ label: 'Importing', tone: 'progress', description: 'Importing from Notion' })}
          />
          Importing from Notion, 1,284 pages so far
        </>
      }
    />
  ),
};

export const Upgrade: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <EmptyState
      layout="split"
      titleSlot="Upgrade to use alerts"
      descriptionSlot="Alerts check your traces, metrics, and scores on a schedule and notify your team when one crosses a threshold you set."
      iconSlot={<EmptyStateArt name="alerts" />}
      actionSlot={
        <div className="flex items-center gap-3">
          <Button variant="primary" iconEnd={<IconArrowRight />}>
            Upgrade
          </Button>
          <Button variant="link" iconEnd={<IconArrowUpRight />}>
            Learn about alerts
          </Button>
        </div>
      }
    />
  ),
};

export const InANarrowPanel: Story = {
  render: () => (
    <div className="w-96 rounded-lg bg-card">
      <EmptyState
        {...knowledge}
        iconSlot={<EmptyStateArt name="knowledge" />}
        actionSlot={<Button variant="primary">Set up knowledge</Button>}
        statusSlot="Creates a dedicated Postgres database."
      />
    </div>
  ),
};
