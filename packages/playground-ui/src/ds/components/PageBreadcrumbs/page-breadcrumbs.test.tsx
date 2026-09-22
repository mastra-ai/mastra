// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PageBreadcrumbs } from './index';
import type { CrumbDef } from './index';
import type { LinkComponentProps } from '@/ds/types/link-component';

const Link = (props: LinkComponentProps) => <a {...props} />;

afterEach(cleanup);

describe('PageBreadcrumbs', () => {
  describe('when given crumbs with links', () => {
    const crumbs: CrumbDef[] = [
      { id: 'factory', label: 'Acme', to: '/factories/acme' },
      { id: 'boards', label: 'Boards', to: '/factories/acme/boards' },
      { id: 'board', label: 'Sprint 1', to: '/factories/acme/boards/1' },
    ];

    it('renders links for all but the last crumb', () => {
      render(<PageBreadcrumbs crumbs={crumbs} LinkComponent={Link} />);

      const links = screen.getAllByRole('link');
      expect(links.map(link => link.getAttribute('href'))).toEqual(['/factories/acme', '/factories/acme/boards']);
      expect(screen.queryByRole('link', { name: 'Sprint 1' })).toBeNull();
    });

    it('marks the last crumb as the current page', () => {
      render(<PageBreadcrumbs crumbs={crumbs} LinkComponent={Link} />);

      expect(screen.getByText('Sprint 1').closest('[aria-current="page"]')).not.toBeNull();
    });
  });

  describe('when a crumb renders a component', () => {
    it('renders the component as the crumb content', () => {
      const crumbs: CrumbDef[] = [{ id: 'entity', Component: () => <span>Entity name</span> }];

      render(<PageBreadcrumbs crumbs={crumbs} LinkComponent={Link} />);

      expect(screen.getByText('Entity name')).not.toBeNull();
    });
  });

  describe('when there are no crumbs', () => {
    it('renders nothing', () => {
      const { container } = render(<PageBreadcrumbs crumbs={[]} LinkComponent={Link} />);

      expect(container.innerHTML).toBe('');
    });
  });
});
