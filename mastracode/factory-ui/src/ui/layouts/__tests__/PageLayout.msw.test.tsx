import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageLayout, ViewportLayout } from '../PageLayout';

describe.each([
  { mode: 'document', Layout: PageLayout },
  { mode: 'viewport', Layout: ViewportLayout },
])('$mode page layout', ({ Layout }) => {
  describe('given page slots are provided', () => {
    it('renders the sidebar, mobile header, and content inside the main surface', () => {
      render(
        <Layout sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
          <div>content-slot</div>
        </Layout>,
      );

      expect(screen.getByText('sidebar-slot')).toBeInTheDocument();
      expect(screen.getByText('header-slot')).toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('content-slot');
    });
  });

  describe('given page content raises its own stacking order', () => {
    // jsdom has no layout, so paint order can only be asserted through the
    // class: without it the DS pill tabs (z-10) scroll over the sticky header.
    it('isolates the content surface into its own stacking context', () => {
      render(
        <Layout sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
          <div>content-slot</div>
        </Layout>,
      );

      expect(screen.getByRole('main').className).toContain('isolate');
    });
  });

  describe('given the header slot is omitted', () => {
    it('renders an unlabelled full-height content surface', () => {
      render(
        <Layout sidebar={<div>sidebar-slot</div>}>
          <div>content-slot</div>
        </Layout>,
      );

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('content-slot');
    });
  });
});
