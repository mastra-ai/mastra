import type { Meta, StoryObj } from '@storybook/react-vite';
import { SlidersHorizontalIcon } from 'lucide-react';

import { Button } from '../Button';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import { Column, Columns } from './index';

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
    <Column className="p-5">
      <Column.Toolbar>
        <h2 className="text-heading text-foreground">{title}</h2>
        <Button size="sm" variant="ghost">
          <SlidersHorizontalIcon />
          Configure
        </Button>
      </Column.Toolbar>
      <Column.Content className="gap-3">
        {columnContent.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
            <CardContent density="compact" className="text-caption text-muted-foreground">
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
    <div className="h-144 bg-sidebar p-4">
      <Columns className="md:grid-cols-2">
        <MetricsColumn title="Production" />
        <MetricsColumn title="Development" />
      </Columns>
    </div>
  ),
};
