import type { Meta, StoryObj } from '@storybook/react-vite';
import { Status } from './status';
import { StatusDot } from './status-dot';
import { deployStates, type DeployState, type StatusPresentation } from './status-dot-styles';
import { TooltipProvider } from '@/ds/components/Tooltip';

const DESCRIPTIONS: Record<DeployState, string> = {
  ready: 'The server is live and responding to requests.',
  building: 'The deploy is uploading, building, or starting.',
  idle: 'The server scaled down during inactivity and wakes on the next request.',
  queued: 'The deploy is waiting in the queue.',
  stopped: 'The server is not serving traffic.',
  error: 'The deploy failed or crashed. Check the logs for details.',
};

const STATES: DeployState[] = ['ready', 'building', 'idle', 'queued', 'stopped', 'error'];

function presentation(state: DeployState | null): StatusPresentation {
  const key = state ?? 'error';
  return { ...deployStates[key], description: DESCRIPTIONS[key] };
}

const meta: Meta<typeof StatusDot<DeployState>> = {
  title: 'Feedback/StatusIndicators/StatusDot',
  component: StatusDot,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Deploy and server status only. One circular shape: color and the filled or ring treatment carry meaning. Use `deployStates` for the canonical labels. Map every provider status onto these six; never show "unknown". Other statuses (workflow runs, queues, sandboxes, cron) use a Badge with their real state words.',
      },
    },
  },
  decorators: [Story => <TooltipProvider delay={0}>{Story()}</TooltipProvider>],
  args: {
    status: 'ready',
    presentation,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <main className="flex flex-wrap items-center justify-center gap-6 text-meta text-foreground">
      <h1 className="sr-only">Deploy status states</h1>
      {STATES.map(state => (
        <Status key={state} presentation={presentation(state)} />
      ))}
    </main>
  ),
};
