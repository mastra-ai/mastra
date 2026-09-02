import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionCard } from './section-card';

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

const meta: Meta<typeof SectionCard> = {
  title: 'Layout/SectionCard',
  component: SectionCard,
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
type Story = StoryObj<typeof SectionCard>;

export const Default: Story = {
  render: () => (
    <SectionCard title="Activity Over Time" description="Track request volume, cost, and latency over time">
      <p className="text-(--text-secondary)">Body content goes here.</p>
    </SectionCard>
  ),
};

export const WithAction: Story = {
  render: () => (
    <SectionCard
      title="Activity Over Time"
      description="Track request volume, cost, and latency over time"
      action={
        <div className="text-ui-sm flex gap-2 text-(--text-secondary)">
          <span>Cost</span>
          <span>Requests</span>
          <span>Tokens</span>
          <span>Errors</span>
        </div>
      }
    >
      <div className="bg-surface-raised h-40 rounded-md" />
    </SectionCard>
  ),
};

export const Danger: Story = {
  render: () => (
    <SectionCard
      variant="danger"
      title="Delete project"
      description="Irreversible. All data, deployments, and members will be removed."
    >
      <p className="text-error/80">Confirmation controls go here.</p>
    </SectionCard>
  ),
};

export const FillHeight: Story = {
  render: () => (
    <div className="grid h-105 grid-cols-2 gap-4">
      <SectionCard fillHeight title="Left" description="Stretches to grid row height">
        <div className="bg-surface-raised h-full rounded-md" />
      </SectionCard>
      <SectionCard fillHeight title="Right" description="Same height as sibling">
        <div className="bg-surface-raised h-full rounded-md" />
      </SectionCard>
    </div>
  ),
};

// Verifies card readability across all studio surface tokens — default + danger variants.
export const OnSurfaces: Story = {
  decorators: [Story => <>{Story()}</>],
  render: () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {SURFACES.map(({ token, label, className }) => (
        <SurfaceFrame key={token} className={className} label={label}>
          <div className="flex flex-col gap-4">
            <SectionCard title="Activity Over Time" description="Default variant on this surface.">
              <p className="text-(--text-secondary)">Body content goes here.</p>
            </SectionCard>
            <SectionCard variant="danger" title="Delete project" description="Danger variant on this surface.">
              <p className="text-error/80">Confirmation controls go here.</p>
            </SectionCard>
          </div>
        </SurfaceFrame>
      ))}
    </div>
  ),
};
