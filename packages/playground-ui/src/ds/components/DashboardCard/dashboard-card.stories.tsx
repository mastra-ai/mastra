import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardCard } from './dashboard-card';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'surface1', label: 'surface1 · 0% (studio shell)', className: 'bg-surface-primary' },
  { token: 'surface2', label: 'surface2 · 16% (main frame)', className: 'bg-surface-secondary' },
  { token: 'surface3', label: 'surface3 · 18%', className: 'bg-surface-raised' },
  { token: 'surface4', label: 'surface4 · 22%', className: 'bg-surface-hover' },
];

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-(--border-subtle) p-6 ${className}`}>
      <p className="text-ui-xs mb-4 tracking-wide text-(--text-secondary) uppercase">{label}</p>
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
      <div className="bg-surface-secondary rounded-2xl border border-(--border-subtle) p-6">
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
      <p className="text-(--text-secondary)">Default dashboard card content</p>
    </DashboardCard>
  ),
};

export const WithCustomClass: Story = {
  render: () => (
    <DashboardCard className="min-w-80">
      <p className="text-(--text-secondary)">Card with custom min-width</p>
    </DashboardCard>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="flex gap-4">
      <DashboardCard className="min-w-60">
        <p className="text-(--text-secondary)">Card 1</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-(--text-secondary)">Card 2</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-(--text-secondary)">Card 3</p>
      </DashboardCard>
    </div>
  ),
};

// Verifies card readability across all studio surface tokens.
export const OnSurfaces: Story = {
  decorators: [Story => <>{Story()}</>],
  render: () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {SURFACES.map(({ token, label, className }) => (
        <SurfaceFrame key={token} className={className} label={label}>
          <DashboardCard>
            <p className="text-(--text-secondary)">Same card, rendered on each surface token.</p>
          </DashboardCard>
        </SurfaceFrame>
      ))}
    </div>
  ),
};
