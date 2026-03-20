import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowError({ message }: { message: string }) {
  throw new Error(message);
  return null;
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Feedback/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const WithError: Story = {
  render: () => (
    <ErrorBoundary>
      <ThrowError message="Something unexpected happened. Please try again later." />
    </ErrorBoundary>
  ),
};

export const WithChildren: Story = {
  render: () => (
    <ErrorBoundary>
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral3">Everything is fine. Children render normally.</p>
      </div>
    </ErrorBoundary>
  ),
};
