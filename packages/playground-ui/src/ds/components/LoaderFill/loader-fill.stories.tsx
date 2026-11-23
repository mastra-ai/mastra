import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect } from 'storybook/test';

import { Spinner } from '../Spinner';
import { Txt } from '../Txt';
import { LoaderFill } from './loader-fill';

const meta: Meta<typeof LoaderFill> = {
  title: 'Elements/LoaderFill',
  component: LoaderFill,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof LoaderFill>;

function Area({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-testid="area" className={`border border-dashed border-border ${className ?? ''}`}>
      {children}
    </div>
  );
}

const loader = (
  <LoaderFill>
    <Spinner />
  </LoaderFill>
);

export const WithText: Story = {
  render: () => (
    <Area className="h-64">
      <LoaderFill>
        <Spinner size="sm" aria-hidden />
        <Txt as="span" variant="caption" tone="muted">
          Loading storage capabilities
        </Txt>
      </LoaderFill>
    </Area>
  ),
};

/** Block, flex column, flex row and grid parents, with a set height and without one. */
export const Parents: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <Area className="h-64">{loader}</Area>
      <Area className="flex h-64 flex-col">{loader}</Area>
      <Area className="flex h-64">{loader}</Area>
      <Area className="grid h-64">{loader}</Area>
      <Area>{loader}</Area>
      <Area className="flex flex-col">{loader}</Area>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const area of canvasElement.querySelectorAll('[data-testid=area]')) {
      const box = area.getBoundingClientRect();
      const fill = area.querySelector('[data-slot=loader-fill]')?.getBoundingClientRect();
      if (!fill) throw new Error('Missing the loader');
      await expect(fill.top + fill.height / 2).toBeCloseTo(box.top + box.height / 2, 0);
      await expect(fill.left + fill.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
    }
  },
};
