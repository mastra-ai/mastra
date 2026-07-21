import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageLayout } from '../PageLayout';

describe('PageLayout', () => {
  describe('given page slots are provided', () => {
    it('renders the sidebar, mobile header, ReactNode heading, description, and content', () => {
      render(
        <PageLayout
          sidebar={<div>sidebar-slot</div>}
          header={<div>header-slot</div>}
          title={
            <>
              Factory <strong>Board</strong>
            </>
          }
          description={<span>Project work in progress</span>}
        >
          <div>content-slot</div>
        </PageLayout>,
      );

      expect(screen.getByText('sidebar-slot')).toBeInTheDocument();
      expect(screen.getByText('header-slot')).toBeInTheDocument();
      const heading = screen.getByRole('heading', { name: 'Factory Board' });
      const content = screen.getByText('content-slot');

      expect(heading).toBeInTheDocument();
      expect(screen.getByText('Project work in progress')).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(heading.parentElement?.parentElement).toContainElement(content);
    });
  });

  describe('given heading slots are omitted', () => {
    it('renders an unlabelled full-height content surface', () => {
      render(
        <PageLayout sidebar={<div>sidebar-slot</div>}>
          <div>content-slot</div>
        </PageLayout>,
      );

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('content-slot');
    });
  });
});
