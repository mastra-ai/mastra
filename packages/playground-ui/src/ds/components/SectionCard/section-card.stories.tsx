import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionCard } from './section-card';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'sidebar', label: 'sidebar · the recessed shell', className: 'bg-sidebar' },
  { token: 'background', label: 'background · the page canvas', className: 'bg-background' },
  { token: 'card', label: 'card · a raised surface', className: 'bg-card' },
  { token: 'muted', label: 'muted · the quiet step above the canvas', className: 'bg-muted' },
];

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <div className={`border-border rounded-2xl border p-6 ${className}`}>
      <p className="text-meta text-muted-foreground mb-4 tracking-wide uppercase">{label}</p>
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
      <div className="border-border bg-background rounded-2xl border p-6">
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
      <p className="text-muted-foreground">Body content goes here.</p>
    </SectionCard>
  ),
};

export const WithAction: Story = {
  render: () => (
    <SectionCard
      title="Activity Over Time"
      description="Track request volume, cost, and latency over time"
      action={
        <div className="text-caption text-muted-foreground flex gap-2">
          <span>Cost</span>
          <span>Requests</span>
          <span>Tokens</span>
          <span>Errors</span>
        </div>
      }
    >
      <div className="bg-card h-40 rounded-md" />
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
      <p className="text-accent2/80">Confirmation controls go here.</p>
    </SectionCard>
  ),
};

export const FillHeight: Story = {
  render: () => (
    <div className="grid h-105 grid-cols-2 gap-4">
      <SectionCard fillHeight title="Left" description="Stretches to grid row height">
        <div className="bg-card h-full rounded-md" />
      </SectionCard>
      <SectionCard fillHeight title="Right" description="Same height as sibling">
        <div className="bg-card h-full rounded-md" />
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
              <p className="text-muted-foreground">Body content goes here.</p>
            </SectionCard>
            <SectionCard variant="danger" title="Delete project" description="Danger variant on this surface.">
              <p className="text-accent2/80">Confirmation controls go here.</p>
            </SectionCard>
          </div>
        </SurfaceFrame>
      ))}
    </div>
  ),
};
