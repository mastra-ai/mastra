import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from '../Card';
import { MetricsFlexGrid } from './metrics-flex-grid';

const meta: Meta<typeof MetricsFlexGrid> = {
  title: 'Metrics/MetricsFlexGrid',
  component: MetricsFlexGrid,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsFlexGrid>;

export const Default: Story = {
  render: () => (
    <MetricsFlexGrid>
      <Card className="min-w-60 px-4 py-3">
        <p className="text-muted-foreground">Card 1</p>
      </Card>
      <Card className="min-w-60 px-4 py-3">
        <p className="text-muted-foreground">Card 2</p>
      </Card>
      <Card className="min-w-60 px-4 py-3">
        <p className="text-muted-foreground">Card 3</p>
      </Card>
      <Card className="min-w-60 px-4 py-3">
        <p className="text-muted-foreground">Card 4</p>
      </Card>
    </MetricsFlexGrid>
  ),
};

export const TwoItems: Story = {
  render: () => (
    <MetricsFlexGrid>
      <Card className="min-w-60 px-4 py-3">
        <p className="text-muted-foreground">Card 1</p>
      </Card>
      <Card className="min-w-60 px-4 py-3">
        <p className="text-muted-foreground">Card 2</p>
      </Card>
    </MetricsFlexGrid>
  ),
};
