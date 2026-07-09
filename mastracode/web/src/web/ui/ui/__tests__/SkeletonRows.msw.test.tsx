/**
 * BDD coverage for `SkeletonRows`, the shared loading-placeholder used by every
 * data-loading state in the web UI. The contract other specs rely on: a
 * `role="status"` wrapper named by `label`, containing N shimmer rows.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkeletonRows } from '../SkeletonRows';

describe('SkeletonRows', () => {
  describe('given a label', () => {
    it('exposes an accessible status region named by the label', () => {
      render(<SkeletonRows label="Loading providers" />);

      expect(screen.getByRole('status', { name: 'Loading providers' })).toBeInTheDocument();
    });
  });

  describe('given a row count', () => {
    it('renders that many placeholder rows', () => {
      render(<SkeletonRows label="Loading folders" rows={4} />);

      const region = screen.getByRole('status', { name: 'Loading folders' });
      expect(region.children).toHaveLength(4);
    });
  });

  describe('given no row count', () => {
    it('defaults to 3 rows', () => {
      render(<SkeletonRows label="Loading model packs" />);

      const region = screen.getByRole('status', { name: 'Loading model packs' });
      expect(region.children).toHaveLength(3);
    });
  });
});
