import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardCard } from './dashboard-card';

const BACKGROUNDS: { token: string; label: string; className: string }[] = [
  { token: 'background', label: 'background · page canvas', className: 'bg-background' },
  { token: 'sidebar', label: 'sidebar · navigation rail', className: 'bg-sidebar' },
  { token: 'card', label: 'card · nested in another card', className: 'bg-card' },
  { token: 'muted', label: 'muted · recessed surface', className: 'bg-muted' },
];

function BackgroundFrame({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`new-theme border-border rounded-2xl border p-6 ${className}`}>
      <p className="text-ui-xs text-muted-foreground mb-4 tracking-wide uppercase">{label}</p>
      {children}
    </div>
  );
}

const meta: Meta<typeof DashboardCard> = {
  title: 'Metrics/DashboardCard',
  component: DashboardCard,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    Story => (
      <div className="new-theme border-border bg-background rounded-2xl border p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DashboardCard>;

export const Default: Story = {
  render: () => (
    <DashboardCard>
      <p className="text-muted-foreground">Default dashboard card content</p>
    </DashboardCard>
  ),
};

export const WithCustomClass: Story = {
  render: () => (
    <DashboardCard className="min-w-80">
      <p className="text-muted-foreground">Card with custom min-width</p>
    </DashboardCard>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="flex gap-4">
      <DashboardCard className="min-w-60">
        <p className="text-muted-foreground">Card 1</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-muted-foreground">Card 2</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-muted-foreground">Card 3</p>
      </DashboardCard>
    </div>
  ),
};

export const OnBackgrounds: Story = {
  decorators: [Story => <>{Story()}</>],
  render: () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {BACKGROUNDS.map(({ token, label, className }) => (
        <BackgroundFrame key={token} className={className} label={label}>
          <DashboardCard>
            <p className="text-muted-foreground">Same card, rendered on each semantic background.</p>
          </DashboardCard>
        </BackgroundFrame>
      ))}
    </div>
  ),
};
