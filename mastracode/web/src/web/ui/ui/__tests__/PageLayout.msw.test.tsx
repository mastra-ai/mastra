import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { PageLayout, PageLayoutMainViewProvider } from '../PageLayout';

function StatefulContent() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(value => value + 1)}>
      Count {count}
    </button>
  );
}

function LayoutHarness({ view }: { view?: ReactNode }) {
  return (
    <PageLayoutMainViewProvider view={view}>
      <PageLayout sidebar={<div>sidebar-slot</div>}>
        <StatefulContent />
      </PageLayout>
    </PageLayoutMainViewProvider>
  );
}

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
      // The heading row and page content share the same column container.
      expect(heading.closest('header')?.parentElement).toContainElement(content);
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

  describe('given a temporary main view', () => {
    it('hides and inerts the original body without remounting its stateful child', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<LayoutHarness />);
      const originalMain = screen.getByRole('main');

      await user.click(screen.getByRole('button', { name: 'Count 0' }));
      expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();

      rerender(<LayoutHarness view={<div>settings-view</div>} />);

      expect(originalMain).toHaveAttribute('hidden');
      expect(originalMain).toHaveAttribute('inert');
      expect(originalMain).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByText('Count 1')).toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('settings-view');

      rerender(<LayoutHarness />);

      expect(originalMain).not.toHaveAttribute('hidden');
      expect(originalMain).not.toHaveAttribute('inert');
      expect(originalMain).not.toHaveAttribute('aria-hidden');
      expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
      expect(screen.queryByText('settings-view')).not.toBeInTheDocument();
    });
  });
});
