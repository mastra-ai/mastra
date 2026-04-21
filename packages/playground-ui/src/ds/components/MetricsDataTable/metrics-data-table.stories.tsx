import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricsDataTable } from './metrics-data-table';

type ModelRow = {
  key: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

const sampleData: ModelRow[] = [
  { key: 'gpt-4o', model: 'gpt-4o', input: 12450, output: 8320, cacheRead: 3200, cacheWrite: 1100 },
  {
    key: 'claude-sonnet',
    model: 'claude-sonnet-4-20250514',
    input: 9800,
    output: 6540,
    cacheRead: 2100,
    cacheWrite: 890,
  },
  { key: 'gpt-4o-mini', model: 'gpt-4o-mini', input: 5600, output: 3200, cacheRead: 1800, cacheWrite: 450 },
  {
    key: 'claude-haiku',
    model: 'claude-haiku-4-5-20251001',
    input: 3200,
    output: 1800,
    cacheRead: 900,
    cacheWrite: 200,
  },
];

const columns: { label: string; value: (row: ModelRow) => string | number; highlight?: boolean }[] = [
  { label: 'Model', value: (row: ModelRow) => row.model },
  { label: 'Input', value: (row: ModelRow) => row.input.toLocaleString() },
  { label: 'Output', value: (row: ModelRow) => row.output.toLocaleString() },
  { label: 'Cache Read', value: (row: ModelRow) => row.cacheRead.toLocaleString() },
  { label: 'Cache Write', value: (row: ModelRow) => row.cacheWrite.toLocaleString() },
  { label: 'Cost', value: () => '—', highlight: true as const },
];

const meta: Meta<typeof MetricsDataTable<ModelRow>> = {
  title: 'Metrics/MetricsDataTable',
  component: MetricsDataTable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MetricsDataTable<ModelRow>>;

export const Default: Story = {
  args: {
    columns,
    data: sampleData,
  },
};

export const ManyRows: Story = {
  args: {
    columns,
    data: Array.from({ length: 20 }, (_, i) => ({
      key: `model-${i}`,
      model: `model-variant-${i}`,
      input: (i * 1379) % 15001,
      output: (i * 977) % 10001,
      cacheRead: (i * 541) % 5001,
      cacheWrite: (i * 313) % 2001,
    })),
  },
};

export const Empty: Story = {
  args: {
    columns,
    data: [],
  },
};
