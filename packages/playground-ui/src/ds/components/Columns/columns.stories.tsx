import type { Meta, StoryObj } from '@storybook/react-vite';
import { SlidersHorizontalIcon } from 'lucide-react';

import { Button } from '../Button';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import { Column, Columns, MultiColumn } from './index';

const meta: Meta<typeof Columns> = {
  title: 'Layout/Columns',
  component: Columns,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Columns>;

const columnContent = [
  ['Agent runs', '126'],
  ['Success rate', '98.4%'],
  ['Median latency', '842 ms'],
] as const;

function MetricsColumn({ title }: { title: string }) {
  return (
    <Column className="p-5" withRightSeparator>
      <Column.Toolbar>
        <h2 className="text-neutral5 text-lg">{title}</h2>
        <Button size="sm" variant="ghost">
          <SlidersHorizontalIcon />
          Configure
        </Button>
      </Column.Toolbar>
      <Column.Content className="gap-3">
        {columnContent.map(([label, value]) => (
          <Card key={label} appearance="surface">
            <CardHeader>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
            <CardContent density="compact" className="text-ui-sm text-neutral3">
              {label}
            </CardContent>
          </Card>
        ))}
      </Column.Content>
    </Column>
  );
}

export const ResponsiveGrid: Story = {
  render: () => (
    <div className="bg-surface1 h-144 p-4">
      <Columns className="md:grid-cols-2">
        <MetricsColumn title="Production" />
        <MetricsColumn title="Development" />
      </Columns>
    </div>
  ),
};

export const HorizontallyScrollable: Story = {
  render: () => (
    <div className="bg-surface1 h-128 w-full max-w-3xl p-4">
      <MultiColumn numOfColumns={3} minColumnWidth="18rem">
        <MetricsColumn title="Agents" />
        <MetricsColumn title="Workflows" />
        <MetricsColumn title="Tools" />
      </MultiColumn>
    </div>
  ),
};
