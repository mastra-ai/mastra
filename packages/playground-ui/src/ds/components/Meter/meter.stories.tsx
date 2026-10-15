import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import { Meter } from './meter';
import { Card, CardContent } from '@/ds/components/Card';
import { Txt } from '@/ds/components/Txt';
import { formatFullNumber } from '@/utils/cost';

const meta = {
  title: 'DataDisplay/Meter',
  component: Meter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Usage against an allowance, as a thin bar. Within the allowance the used part fills the track. Past it, the bar fills, and the part beyond the allowance turns red, sized to how far over it is. The meter draws only the bar: put the name and reading beside it with `Txt`, and pass `aria-valuetext` with the same reading so screen readers hear the units.',
      },
    },
  },
  args: {
    value: 148,
    max: 360,
    'aria-label': 'Memory',
    'aria-valuetext': '148 of 360 GB-hours',
  },
  argTypes: {
    value: { control: { type: 'number', min: 0 } },
    max: { control: { type: 'number', min: 0 } },
  },
  render: args => (
    <div className="max-w-md">
      <Meter {...args} />
    </div>
  ),
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof Meter>;

export const Default: Story = {};

export const OverAllowance: Story = {
  args: { value: 112, max: 100, 'aria-label': 'vCPU', 'aria-valuetext': '112 of 100 vCPU-hours, 12 over' },
  parameters: {
    docs: {
      description: {
        story: 'Past the allowance the bar is full, and the red end is sized to how far over the reading is.',
      },
    },
  },
};

export const AtAllowance: Story = {
  args: { value: 100, max: 100, 'aria-label': 'vCPU', 'aria-valuetext': '100 of 100 vCPU-hours' },
  parameters: {
    docs: {
      description: {
        story: 'Exactly at the allowance the bar is full with no red: nothing is charged yet.',
      },
    },
  },
};

export const TinyUsage: Story = {
  args: { value: 120, max: 250_000, 'aria-label': 'Events', 'aria-valuetext': '120 of 250,000 events' },
  parameters: {
    docs: {
      description: {
        story: 'Every fill keeps at least a few pixels, so a tiny reading still shows.',
      },
    },
  },
};

export const NearlyFull: Story = {
  args: { value: 9.9, max: 10, 'aria-label': 'Egress', 'aria-valuetext': '9.9 of 10 GB' },
  parameters: {
    docs: {
      description: {
        story: 'The track keeps a few pixels too, so a nearly full bar still shows the space left.',
      },
    },
  },
};

export const Unused: Story = {
  args: { value: 0, max: 360, 'aria-valuetext': '0 of 360 GB-hours' },
  parameters: {
    docs: {
      description: {
        story: 'Nothing used yet: an empty track.',
      },
    },
  },
};

export const NoAllowance: Story = {
  args: { value: 0, max: 0, 'aria-label': 'Storage', 'aria-valuetext': 'No allowance' },
  parameters: {
    docs: {
      description: {
        story: 'A zero allowance with nothing used still draws the track, so the row keeps its height.',
      },
    },
  },
};

export const WithSources: Story = {
  args: { value: 148, max: 360, 'aria-label': 'Memory', 'aria-valuetext': '148 of 360 GB-hours' },
  parameters: {
    docs: {
      description: {
        story:
          'Pass `Meter.Source` children to say where the usage came from. Hover or focus the bar: it splits into one color per source, and a tooltip keys each source, its amount, and what is left. The sources should add up to `value`. Colors follow the order of the sources, from the same palette as `MetricsShareList`.',
      },
    },
  },
  render: args => (
    <div className="max-w-md pt-24">
      <Meter {...args}>
        <Meter.Source label="research-workflows" value={112} />
        <Meter.Source label="Sandboxes" value={36} />
      </Meter>
    </div>
  ),
};

export const WithSourcesOverAllowance: Story = {
  args: { value: 112, max: 100, 'aria-label': 'vCPU', 'aria-valuetext': '112 of 100 vCPU-hours, 12 over' },
  parameters: {
    docs: {
      description: {
        story:
          'Over the allowance, the sources keep their colors up to a tick at the allowance, and everything past it stays red. The key ends with the overage instead of what is left.',
      },
    },
  },
  render: args => (
    <div className="max-w-md pt-24">
      <Meter {...args}>
        <Meter.Source label="research-workflows" value={88} />
        <Meter.Source label="Sandboxes" value={24} />
      </Meter>
    </div>
  ),
};

export const ManySources: Story = {
  args: {
    value: 96_420,
    max: 250_000,
    'aria-label': 'Observability events',
    'aria-valuetext': '96,420 of 250,000 events',
  },
  parameters: {
    docs: {
      description: {
        story: 'Past five sources the colors repeat, so roll the smallest into one "Other" source before that.',
      },
    },
  },
  render: args => (
    <div className="max-w-md pt-40">
      <Meter {...args}>
        <Meter.Source label="support-agent" value={41_200} />
        <Meter.Source label="research-workflows" value={28_900} />
        <Meter.Source label="billing-assistant" value={14_300} />
        <Meter.Source label="onboarding-flow" value={8_020} />
        <Meter.Source label="Other (3)" value={4_000} />
      </Meter>
    </div>
  ),
};

type Allowance = { name: string; value: number; max: number; unit: string };

const ALLOWANCES: Allowance[] = [
  { name: 'Memory', value: 148, max: 360, unit: 'GB-hours' },
  { name: 'vCPU', value: 112, max: 100, unit: 'vCPU-hours' },
  { name: 'Egress', value: 3.4, max: 10, unit: 'GB' },
  { name: 'Observability events', value: 96_420, max: 250_000, unit: '' },
];

function AllowanceReading({ name, value, max, unit }: Allowance) {
  const labelId = useId();
  const unitSuffix = unit ? ` ${unit}` : '';
  const allowance = `of ${formatFullNumber(max)}${unitSuffix}`;
  const reading = `${formatFullNumber(value)} ${allowance}`;
  const over = value - max;
  const valueClassName = over > 0 ? 'text-destructive-indicator' : 'text-foreground';
  const valueText = over > 0 ? `${reading}, ${formatFullNumber(over)} over` : reading;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Txt as="span" id={labelId} variant="label" tone="ink">
          {name}
        </Txt>
        <Txt as="span" variant="body-sm" tone="muted" className="tabular-nums">
          <span className={valueClassName}>{formatFullNumber(value)}</span> {allowance}
        </Txt>
      </div>
      <Meter value={value} max={max} aria-labelledby={labelId} aria-valuetext={valueText} />
    </div>
  );
}

export const UsageCard: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The usage card from the Billing page: each allowance is a label and reading over its meter, two to a row. Over an allowance, the reading turns red with the bar. The visible label names the meter through `aria-labelledby`.',
      },
    },
  },
  render: () => (
    <Card className="max-w-3xl">
      <CardContent className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {ALLOWANCES.map(allowance => (
          <AllowanceReading key={allowance.name} {...allowance} />
        ))}
      </CardContent>
    </Card>
  ),
};
