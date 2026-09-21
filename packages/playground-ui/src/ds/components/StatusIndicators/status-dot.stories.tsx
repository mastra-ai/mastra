import type { Meta, StoryObj } from '@storybook/react-vite';
import { Status } from './status';
import { StatusDot } from './status-dot';
import type { StatusPresentation } from './status-dot-styles';
import { TooltipProvider } from '@/ds/components/Tooltip';

const STATUSES = ['success', 'progress', 'error', 'idle', 'stopped', 'unknown'] as const;
type StoryStatus = (typeof STATUSES)[number];

const PRESENTATIONS = {
  success: {
    label: 'Running',
    tone: 'success',
    description: 'The server is live and responding to requests.',
  },
  progress: {
    label: 'Building',
    tone: 'progress',
    description: 'The server is building from source.',
  },
  error: {
    label: 'Error',
    tone: 'error',
    description: 'The deploy failed. Check the logs for details.',
  },
  idle: {
    label: 'Idle',
    tone: 'idle',
    description: 'The server scaled down during inactivity.',
  },
  stopped: {
    label: 'Stopped',
    tone: 'neutral',
    glyph: 'square',
    description: 'The server is no longer serving traffic.',
  },
  unknown: {
    label: 'Unknown',
    tone: 'neutral',
    glyph: 'dashed',
    description: 'The server status is unavailable.',
  },
} satisfies Record<StoryStatus, StatusPresentation>;

function presentation(status: StoryStatus | null): StatusPresentation {
  return status ? PRESENTATIONS[status] : PRESENTATIONS.unknown;
}

const meta: Meta<typeof StatusDot<StoryStatus>> = {
  title: 'Feedback/StatusIndicators/StatusDot',
  component: StatusDot,
  parameters: { layout: 'centered' },
  decorators: [Story => <TooltipProvider delay={0}>{Story()}</TooltipProvider>],
  args: {
    status: 'success',
    presentation,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <main className="flex flex-wrap items-center justify-center gap-6">
      <h1 className="sr-only">Status dot tones</h1>
      {STATUSES.map(status => (
        <Status key={status} presentation={PRESENTATIONS[status]} />
      ))}
    </main>
  ),
};
