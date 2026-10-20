// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// boneyard measures its container with a ResizeObserver on every mount.
import '@/test/inert-resize-observer';
import { BoneSkeleton } from './bone-skeleton';

describe('BoneSkeleton', () => {
  it('marks the named container busy and announces the label while loading', () => {
    const { container } = render(
      <BoneSkeleton name="data-list" loading label="Loading runs">
        <p>Loaded content</p>
      </BoneSkeleton>,
    );

    const bone = container.querySelector('[data-boneyard="data-list"]');
    expect(bone).not.toBeNull();
    expect(bone?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status', { name: 'Loading runs' })).toBeTruthy();
  });

  it('renders the children and drops the status once loaded', () => {
    const { container } = render(
      <BoneSkeleton name="data-list" loading={false} label="Loading runs">
        <p>Loaded content</p>
      </BoneSkeleton>,
    );

    expect(screen.getByText('Loaded content')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[data-boneyard="data-list"]')?.getAttribute('aria-busy')).not.toBe('true');
  });
});
