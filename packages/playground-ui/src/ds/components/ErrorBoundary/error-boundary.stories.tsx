import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow, label }: { shouldThrow: boolean; label?: string }) {
  if (shouldThrow) {
    throw new Error("Cannot read properties of undefined (reading 'skills')");
  }
  return <p className="text-(--text-primary)">{label ?? 'Component rendered successfully.'}</p>;
}

function InteractiveDemo() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => setShouldThrow(v => !v)}>
          Toggle error
        </Button>
        <Button onClick={() => setResetKey(k => k + 1)}>Change resetKey</Button>
      </div>
      <ErrorBoundary resetKeys={[resetKey]}>
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </div>
  );
}

function ScopedBoundaryDemo() {
  return (
    <div className="grid h-105 w-180 grid-cols-[200px_1fr] gap-4 rounded-lg border border-(--border-subtle) p-3">
      <aside className="bg-surface-raised flex flex-col gap-2 rounded-md p-3">
        <p className="text-ui-sm font-medium text-(--text-primary)">Sidebar</p>
        <p className="text-ui-xs text-(--text-secondary)">
          Still interactive — the crash is scoped to the editor panel.
        </p>
      </aside>
      <main className="flex flex-col gap-3">
        <div className="bg-surface-raised rounded-md p-3">
          <p className="text-ui-sm font-medium text-(--text-primary)">Header</p>
          <p className="text-ui-xs text-(--text-secondary)">Unaffected by the failing panel below.</p>
        </div>
        <div className="bg-surface-secondary flex-1 overflow-hidden rounded-md border border-(--border-subtle)">
          <ErrorBoundary
            title="The agent editor failed to render"
            description="A referenced workspace skill could not be resolved."
          >
            <Bomb shouldThrow />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Feedback/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const SectionVariantSmallParent: Story = {
  name: 'Section variant — small container',
  render: () => (
    <div className="h-65 w-95 rounded-lg border border-(--border-subtle)">
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    </div>
  ),
};

export const SectionVariantLargeParent: Story = {
  name: 'Section variant — large container (scales up)',
  render: () => (
    <div className="h-140 w-220 rounded-lg border border-(--border-subtle)">
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    </div>
  ),
};

export const InlineVariant: Story = {
  name: 'Inline variant — stays compact',
  render: () => (
    <div className="h-105 w-180 rounded-lg border border-(--border-subtle) p-4">
      <ErrorBoundary variant="inline">
        <Bomb shouldThrow />
      </ErrorBoundary>
    </div>
  ),
};

export const ScopedToOneComponent: Story = {
  name: 'Scoped to a single component',
  render: () => <ScopedBoundaryDemo />,
};

export const CustomCopy: Story = {
  render: () => (
    <ErrorBoundary
      title="We couldn't load the agent editor"
      description="This agent references a skill that could not be resolved."
    >
      <Bomb shouldThrow />
    </ErrorBoundary>
  ),
};

export const CustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <div className="flex flex-col items-center gap-3 rounded-md border border-(--border-subtle) p-6">
          <p className="text-ui-md text-(--text-primary)">Custom fallback: {error.message}</p>
          <Button onClick={reset}>Retry</Button>
        </div>
      )}
    >
      <Bomb shouldThrow />
    </ErrorBoundary>
  ),
};

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
