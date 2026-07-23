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
