import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowsList } from '../workflows-list';
import { originWorkflowsFixture, runCountsFixture, workflowsFixture } from './fixtures/workflows';
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

const useRunCountsHandler = () => {
  const onRunCountsRequest = vi.fn<() => void>();
  server.use(
    http.get(`${TEST_BASE_URL}/api/workflows/run-counts`, () => {
      onRunCountsRequest();
      return HttpResponse.json(runCountsFixture);
    }),
  );
  return onRunCountsRequest;
};

const useRunCounts404Handler = () => {
  const onRunCountsRequest = vi.fn<() => void>();
  server.use(
    http.get(`${TEST_BASE_URL}/api/workflows/run-counts`, () => {
      onRunCountsRequest();
      return new HttpResponse(null, { status: 404 });
    }),
  );
  return onRunCountsRequest;
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
      useRunCountsHandler();
      const { queryClient } = renderList();

      expect(screen.getByText('prd-ship-product')).not.toBeNull();
      expect(screen.getByText('Running')).not.toBeNull();
      expect(screen.getByText('Pending input')).not.toBeNull();
      expect(screen.getByText('Number of steps')).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('keeps the expand toggle outside the row link', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList();

      const toggle = screen.getByRole('button', { name: 'Expand nested workflows of prd-ship-product' });
      expect(toggle.closest('a')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when workflows have registered nested children', () => {
    it('shows a nested badge listing children resolved across registry key styles', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList();

      const parentRow = rowFor('prd-ship-product');
      const badge = parentRow.getByTitle('Nested workflows: prd-groom-product, prd-fix-product');
      expect(badge.textContent?.trim()).toBe('2');

      await waitForMutationsIdle(queryClient);
    });

    it('offers no badge or toggle on plain leaf rows', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList();

      const leafRow = rowFor('prd-fix-product');
      expect(leafRow.queryByTitle(/Nested workflows/)).toBeNull();
      expect(leafRow.queryByRole('button')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when a parent row is expanded', () => {
    it('reveals child rows linked by registry key and collapses back', async () => {
      useRunCountsHandler();
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
      useRunCountsHandler();
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
      useRunCountsHandler();
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
      useRunCountsHandler();
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
    it('shows running and pending-input counts from the aggregated endpoint and hides zeros', async () => {
      const onRunCountsRequest = useRunCountsHandler();
      const { queryClient } = renderList();

      const runnerRow = rowFor('eng-runner');
      expect(await runnerRow.findByLabelText('3 runs in progress')).not.toBeNull();

      // HITL: suspended runs surface in the Pending input column.
      const groomRow = rowFor('prd-groom-product');
      expect(await groomRow.findByLabelText('2 runs awaiting input')).not.toBeNull();

      // Idle workflows render empty count cells, never a zero.
      expect(rowFor('prd-fix-product').queryByText('0')).toBeNull();

      // One aggregated request serves every workflow — no per-workflow N+1.
      expect(onRunCountsRequest).toHaveBeenCalledTimes(1);

      await waitForMutationsIdle(queryClient);
    });

    it('degrades to blank count columns and stops polling when the server lacks the endpoint', async () => {
      const onRunCountsRequest = useRunCounts404Handler();
      const { queryClient } = renderList();

      expect(screen.getByText('eng-runner')).not.toBeNull();
      await waitForMutationsIdle(queryClient);

      // No counts light up, and nothing crashes — old servers just show blanks.
      expect(screen.queryByLabelText(/runs? in progress/)).toBeNull();
      expect(screen.queryByLabelText(/awaiting input/)).toBeNull();

      // The server said it doesn't have the endpoint — exactly one attempt,
      // no retries, and the poll interval shuts off instead of hammering it.
      expect(onRunCountsRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('when searching', () => {
    it('filters rows by the search term', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList({ search: 'Single entry' });

      expect(screen.getByText('prd-ship-product')).not.toBeNull();
      expect(screen.queryByText('eng-runner')).toBeNull();
      expect(screen.queryByText('loop-a')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the no-match message when nothing matches', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList({ search: 'zzz-no-such-workflow' });

      expect(screen.getByText('No Workflows match your search')).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when navigating with the keyboard', () => {
    const interactiveRows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-row-index]'));

    it('applies a roving tabindex to workflow link rows only', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList();

      const rowElements = interactiveRows();
      expect(rowElements.length).toBeGreaterThan(1);
      expect(rowElements.every(row => row.tagName === 'A')).toBe(true);
      expect(rowElements.map(row => row.tabIndex)).toEqual([0, ...rowElements.slice(1).map(() => -1)]);

      await waitForMutationsIdle(queryClient);
    });

    it('moves focus between rows with ArrowDown/ArrowUp and jumps with Home/End', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList();

      const rowElements = interactiveRows();
      fireEvent.focus(rowElements[0]);
      fireEvent.keyDown(rowElements[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(rowElements[1]);

      fireEvent.keyDown(rowElements[1], { key: 'End' });
      expect(document.activeElement).toBe(rowElements[rowElements.length - 1]);

      fireEvent.keyDown(rowElements[rowElements.length - 1], { key: 'Home' });
      expect(document.activeElement).toBe(rowElements[0]);

      await waitForMutationsIdle(queryClient);
    });

    it('skips inline non-link rows when expanded children are not registered', async () => {
      useRunCountsHandler();
      const { queryClient } = renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-groom-product' }));
      const inlineRow = screen.getByText('use-case-arch').closest('.data-list-row') as HTMLElement;

      // Inline rows never receive a roving tabindex slot.
      expect(inlineRow.querySelector('[data-row-index]')).toBeNull();

      // Indices stay contiguous across only the interactive rows.
      const indices = interactiveRows().map(row => Number(row.dataset.rowIndex));
      expect(indices).toEqual(indices.map((_, i) => i));

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when workflows carry an origin field', () => {
    it("shows the Dynamic badge only for origin: 'dynamic'", async () => {
      useRunCountsHandler();
      const { queryClient } = renderList({ workflows: originWorkflowsFixture });

      expect(screen.getByText('code-wf')).not.toBeNull();
      expect(screen.getByText('dynamic-wf')).not.toBeNull();
      expect(screen.getByText('legacy-wf')).not.toBeNull();

      expect(screen.getAllByText('Dynamic')).toHaveLength(1);
      expect(rowFor('dynamic-wf').getByText('Dynamic')).not.toBeNull();
      expect(rowFor('code-wf').queryByText('Dynamic')).toBeNull();
      expect(rowFor('legacy-wf').queryByText('Dynamic')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });
});
