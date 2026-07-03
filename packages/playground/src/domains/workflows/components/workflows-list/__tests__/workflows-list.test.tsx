import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowsList } from '../workflows-list';
import { runsResponseFor, workflowsFixture } from './fixtures/workflows';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  ({ children, to, href, ...props }, ref) => (
    <a ref={ref} href={to ?? href} {...props}>
      {children}
    </a>
  ),
);

const paths = {
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
} as unknown as LinkComponentProviderProps['paths'];

const useRunsHandler = () => {
  const onRunsRequest = vi.fn<(url: string) => void>();
  server.use(
    http.get(`${TEST_BASE_URL}/api/workflows/:workflowId/runs`, ({ params, request }) => {
      onRunsRequest(request.url);
      const status = new URL(request.url).searchParams.get('status');
      return HttpResponse.json(runsResponseFor(String(params.workflowId), status));
    }),
  );
  return onRunsRequest;
};

const renderList = (props?: Partial<Parameters<typeof WorkflowsList>[0]>) =>
  renderWithProviders(
    <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
      <WorkflowsList workflows={workflowsFixture} isLoading={false} {...props} />
    </LinkComponentProvider>,
  );

/** Full row scope (toggle cell + link) — the wrapper carrying the row marker. */
const rowFor = (name: string) => {
  const row = screen.getByText(name).closest('.data-list-row');
  if (!row) throw new Error(`No row found for ${name}`);
  return within(row as HTMLElement);
};

describe('WorkflowsList', () => {
  describe('when the list renders', () => {
    it('shows the workflow rows and the count columns', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      expect(screen.getByText('prd-ship-product')).not.toBeNull();
      expect(screen.getByText('Running')).not.toBeNull();
      expect(screen.getByText('Pending input')).not.toBeNull();
      expect(screen.getByText('Number of steps')).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('keeps the expand toggle outside the row link', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      const toggle = screen.getByRole('button', { name: 'Expand nested workflows of prd-ship-product' });
      expect(toggle.closest('a')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when workflows have registered nested children', () => {
    it('shows a nested badge listing children resolved across registry key styles', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      const parentRow = rowFor('prd-ship-product');
      const badge = parentRow.getByTitle('Nested workflows: prd-groom-product, prd-fix-product');
      expect(badge.textContent?.trim()).toBe('2');

      await waitForMutationsIdle(queryClient);
    });

    it('offers no badge or toggle on plain leaf rows', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      const leafRow = rowFor('prd-fix-product');
      expect(leafRow.queryByTitle(/Nested workflows/)).toBeNull();
      expect(leafRow.queryByRole('button')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when a parent row is expanded', () => {
    it('reveals child rows linked by registry key and collapses back', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      expect(screen.getAllByText('prd-groom-product')).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-ship-product' }));

      // Root row + child row: both render the name inside a link to the
      // registry-keyed page, and both carry the child's own nested badge.
      const anchors = screen
        .getAllByText('prd-groom-product')
        .map(el => el.closest('a'))
        .filter((anchor): anchor is HTMLAnchorElement => anchor !== null);
      expect(anchors).toHaveLength(2);
      for (const anchor of anchors) {
        expect(anchor.getAttribute('href')).toBe('/workflows/prdGroomProduct');
        expect(within(anchor).getByTitle(/Nested workflows: use-case-arch/)).not.toBeNull();
      }

      fireEvent.click(screen.getByRole('button', { name: 'Collapse nested workflows of prd-ship-product' }));
      expect(screen.getAllByText('prd-groom-product')).toHaveLength(1);

      await waitForMutationsIdle(queryClient);
    });

    it('expands a child row from its own toggle', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-ship-product' }));
      expect(screen.queryByText('use-case-arch')).toBeNull();

      // Two toggles named for prd-groom-product now exist; DOM order puts the
      // child row (inside prd-ship-product's subtree) first, the root row after.
      const groomToggles = screen.getAllByRole('button', { name: 'Expand nested workflows of prd-groom-product' });
      expect(groomToggles).toHaveLength(2);
      fireEvent.click(groomToggles[0]);
      expect(screen.getByText('use-case-arch')).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Collapse nested workflows of prd-groom-product' }));
      expect(screen.queryByText('use-case-arch')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when nested workflows are not registered standalone', () => {
    it('renders them as inline non-link rows', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      expect(screen.queryByText('use-case-arch')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-groom-product' }));

      const inlineName = screen.getByText('use-case-arch');
      expect(inlineName.closest('a')).toBeNull();
      expect(inlineName.closest('.data-list-row')).not.toBeNull();
      expect(screen.getByText('inline')).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when workflows nest each other in a cycle', () => {
    it('does not offer expansion into an ancestor', async () => {
      useRunsHandler();
      const { queryClient } = renderList();

      expect(screen.getAllByRole('button', { name: /nested workflows of loop-b/ })).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of loop-a' }));

      // loop-b renders twice (root + child), but the child row must not offer
      // expanding back into loop-a — the toggle count for loop-b stays 1.
      expect(screen.getAllByText('loop-b')).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /nested workflows of loop-b/ })).toHaveLength(1);

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when runs are active or suspended', () => {
    it('shows running and pending-input counts and hides zeros', async () => {
      const onRunsRequest = useRunsHandler();
      const { queryClient } = renderList();

      const runnerRow = rowFor('eng-runner');
      expect(await runnerRow.findByLabelText('3 runs in progress')).not.toBeNull();

      // HITL: suspended runs surface in the Pending input column.
      const groomRow = rowFor('prd-groom-product');
      expect(await groomRow.findByLabelText('2 runs awaiting input')).not.toBeNull();

      // Idle workflows render empty count cells, never a zero.
      expect(rowFor('prd-fix-product').queryByText('0')).toBeNull();

      // Every request asked for a single item of an explicitly counted status.
      const urls = onRunsRequest.mock.calls.map(([url]) => new URL(url));
      expect(urls.length).toBeGreaterThan(0);
      const statuses = new Set(urls.map(url => url.searchParams.get('status')));
      expect(statuses).toEqual(new Set(['running', 'suspended']));
      for (const url of urls) {
        expect(url.searchParams.get('perPage')).toBe('1');
      }

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when searching', () => {
    it('filters rows by the search term', async () => {
      useRunsHandler();
      const { queryClient } = renderList({ search: 'Single entry' });

      expect(screen.getByText('prd-ship-product')).not.toBeNull();
      expect(screen.queryByText('eng-runner')).toBeNull();
      expect(screen.queryByText('loop-a')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the no-match message when nothing matches', async () => {
      useRunsHandler();
      const { queryClient } = renderList({ search: 'zzz-no-such-workflow' });

      expect(screen.getByText('No Workflows match your search')).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });
});
