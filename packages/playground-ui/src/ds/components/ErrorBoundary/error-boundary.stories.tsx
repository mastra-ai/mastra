import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow, label }: { shouldThrow: boolean; label?: string }) {
  if (shouldThrow) {
    throw new Error("Cannot read properties of undefined (reading 'skills')");
  }
  return <p className="text-neutral5">{label ?? 'Component rendered successfully.'}</p>;
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
    <div className="grid grid-cols-[200px_1fr] gap-4 h-[420px] w-[720px] border border-border1 rounded-lg p-3">
      <aside className="flex flex-col gap-2 rounded-md bg-surface3 p-3">
        <p className="text-ui-sm text-neutral5 font-medium">Sidebar</p>
        <p className="text-ui-xs text-neutral3">Still interactive — the crash is scoped to the editor panel.</p>
      </aside>
      <main className="flex flex-col gap-3">
        <div className="rounded-md bg-surface3 p-3">
          <p className="text-ui-sm text-neutral5 font-medium">Header</p>
          <p className="text-ui-xs text-neutral3">Unaffected by the failing panel below.</p>
        </div>
        <div className="flex-1 rounded-md border border-border1 bg-surface2 overflow-hidden">
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
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const SectionVariantSmallParent: Story = {
  name: 'Section variant — small container',
  render: () => (
    <div className="h-[260px] w-[380px] border border-border1 rounded-lg">
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    </div>
  ),
};

export const SectionVariantLargeParent: Story = {
  name: 'Section variant — large container (scales up)',
  render: () => (
    <div className="h-[560px] w-[880px] border border-border1 rounded-lg">
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    </div>
  ),
};

export const InlineVariant: Story = {
  name: 'Inline variant — stays compact',
  render: () => (
    <div className="h-[420px] w-[720px] border border-border1 rounded-lg p-4">
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
        <div className="flex flex-col items-center gap-3 rounded-md border border-border1 p-6">
          <p className="text-ui-md text-neutral5">Custom fallback: {error.message}</p>
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
