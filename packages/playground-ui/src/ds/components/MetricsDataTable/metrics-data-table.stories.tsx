import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricsDataTable } from './metrics-data-table';

const MODEL_TOKEN_PLACEHOLDERS = [
  '__GATEWAY_OPENAI_MODEL_BASE__',
  '__GATEWAY_OPENAI_MODEL_MINI__',
  '__GATEWAY_ANTHROPIC_MODEL_SONNET__',
  '__GATEWAY_ANTHROPIC_MODEL_HAIKU__',
];

type ModelRow = {
  key: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  latency: number;
  runs: number;
  cost: number;
};

const sampleData: ModelRow[] = [
  {
    key: 'openai-base',
    model: MODEL_TOKEN_PLACEHOLDERS[0],
    input: 12450,
    output: 8320,
    cacheRead: 3200,
    cacheWrite: 1100,
    latency: 184,
    runs: 46,
    cost: 0.018,
  },
  {
    key: 'openai-mini',
    model: MODEL_TOKEN_PLACEHOLDERS[1],
    input: 9800,
    output: 6540,
    cacheRead: 2100,
    cacheWrite: 890,
    latency: 142,
    runs: 32,
    cost: 0.011,
  },
  {
    key: 'anthropic-sonnet',
    model: MODEL_TOKEN_PLACEHOLDERS[2],
    input: 5600,
    output: 3200,
    cacheRead: 1800,
    cacheWrite: 450,
    latency: 226,
    runs: 18,
    cost: 0.024,
  },
  {
    key: 'anthropic-haiku',
    model: MODEL_TOKEN_PLACEHOLDERS[3],
    input: 3200,
    output: 1800,
    cacheRead: 900,
    cacheWrite: 200,
    latency: 118,
    runs: 12,
    cost: 0.006,
  },
];

const columns: { label: string; value: (row: ModelRow) => string | number; highlight?: boolean }[] = [
  { label: 'Model', value: (row: ModelRow) => row.model },
  { label: 'Input', value: (row: ModelRow) => row.input.toLocaleString() },
  { label: 'Output', value: (row: ModelRow) => row.output.toLocaleString() },
  { label: 'Cache Read', value: (row: ModelRow) => row.cacheRead.toLocaleString() },
  { label: 'Cache Write', value: (row: ModelRow) => row.cacheWrite.toLocaleString() },
  { label: 'Latency', value: (row: ModelRow) => `${row.latency}ms` },
  { label: 'Runs', value: (row: ModelRow) => row.runs },
  { label: 'Cost', value: (row: ModelRow) => `$${row.cost.toFixed(3)}`, highlight: true as const },
];

const meta: Meta<typeof MetricsDataTable<ModelRow>> = {
  title: 'Metrics/MetricsDataTable',
  component: MetricsDataTable,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsDataTable<ModelRow>>;

export const Default: Story = {
  render: () => (
    <div className="w-[720px]">
      <MetricsDataTable columns={columns} data={sampleData} />
    </div>
  ),
};

export const ManyRows: Story = {
  render: () => (
    <div className="w-[720px]">
      <MetricsDataTable
        columns={columns}
        data={Array.from({ length: 20 }, (_, i) => ({
          key: `model-${i}`,
          model: MODEL_TOKEN_PLACEHOLDERS[i % MODEL_TOKEN_PLACEHOLDERS.length],
          input: (i * 1379) % 15001,
          output: (i * 977) % 10001,
          cacheRead: (i * 541) % 5001,
          cacheWrite: (i * 313) % 2001,
          latency: 120 + i * 9,
          runs: i + 4,
          cost: i * 0.003 + 0.008,
        }))}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-[720px]">
      <MetricsDataTable columns={columns} data={[]} />
    </div>
  ),
};
