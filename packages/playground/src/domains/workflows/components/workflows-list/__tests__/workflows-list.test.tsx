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

const rowFor = (name: string) => {
  const row = screen.getByText(name).closest('a');
  if (!row) throw new Error(`No row link found for ${name}`);
  return within(row);
};

describe('WorkflowsList', () => {
  it('renders workflow rows with the Running column', async () => {
    useRunsHandler();
    const { queryClient } = renderList();

    expect(screen.getByText('prd-ship-product')).not.toBeNull();
    expect(screen.getByText('Running')).not.toBeNull();
    expect(screen.getByText('Number of steps')).not.toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('shows a nested badge listing children resolved across registry key styles', async () => {
    useRunsHandler();
    const { queryClient } = renderList();

    const parentRow = rowFor('prd-ship-product');
    const badge = parentRow.getByTitle('Nested workflows: prd-groom-product, prd-fix-product');
    expect(badge.textContent?.trim()).toBe('2');

    // Plain leaf → no badge, no chevron.
    const leafRow = rowFor('prd-fix-product');
    expect(leafRow.queryByTitle(/Nested workflows/)).toBeNull();
    expect(leafRow.queryByRole('button')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('expands a parent row to reveal child rows linked by registry key and collapses back', async () => {
    useRunsHandler();
    const { queryClient } = renderList();

    expect(screen.getAllByText('prd-groom-product')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-ship-product' }));

    const occurrences = screen.getAllByText('prd-groom-product');
    expect(occurrences).toHaveLength(2);

    // The child row links to its own workflow page via the REGISTRY key and
    // shows its own nested badge.
    const childRow = occurrences
      .map(el => el.closest('a'))
      .find(anchor => anchor?.getAttribute('href') === '/workflows/prdGroomProduct' && anchor.querySelector('button'));
    expect(childRow).not.toBeUndefined();
    expect(
      within(childRow!)
        .getByTitle(/Nested workflows: use-case-arch/)
        .textContent?.trim(),
    ).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse nested workflows of prd-ship-product' }));
    expect(screen.getAllByText('prd-groom-product')).toHaveLength(1);

    await waitForMutationsIdle(queryClient);
  });

  it('renders unregistered nested workflows as inline non-link rows', async () => {
    useRunsHandler();
    const { queryClient } = renderList();

    expect(screen.queryByText('use-case-arch')).toBeNull();

    // Expand the ROOT prd-groom-product row (the only chevron for it right now).
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-groom-product' }));

    const inlineName = screen.getByText('use-case-arch');
    expect(inlineName.closest('a')).toBeNull();
    const inlineRow = inlineName.closest('.data-list-row') ?? inlineName.closest('div[class*="data-list"]');
    expect(screen.getByText('inline')).not.toBeNull();
    expect(inlineRow).not.toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('toggles a nested row from its tree gutter without navigating', async () => {
    useRunsHandler();
    const { queryClient } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of prd-ship-product' }));
    expect(screen.queryByText('use-case-arch')).toBeNull();

    // The child row's gutter is a redundant, larger toggle target.
    fireEvent.click(screen.getByTestId('tree-gutter-prdShipProduct/prdGroomProduct'));
    expect(screen.getByText('use-case-arch')).not.toBeNull();

    fireEvent.click(screen.getByTestId('tree-gutter-prdShipProduct/prdGroomProduct'));
    expect(screen.queryByText('use-case-arch')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('does not offer expansion into an ancestor, preventing cycles', async () => {
    useRunsHandler();
    const { queryClient } = renderList();

    expect(screen.getAllByRole('button', { name: /nested workflows of loop-b/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Expand nested workflows of loop-a' }));

    expect(screen.getAllByText('loop-b')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /nested workflows of loop-b/ })).toHaveLength(1);

    await waitForMutationsIdle(queryClient);
  });

  it('shows running and pending-input counts from the runs endpoint and hides zeros', async () => {
    const onRunsRequest = useRunsHandler();
    renderList();

    expect(screen.getByText('Pending input')).not.toBeNull();

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
  });

  it('still filters rows by the search term', async () => {
    useRunsHandler();
    const { queryClient } = renderList({ search: 'Single entry' });

    expect(screen.getByText('prd-ship-product')).not.toBeNull();
    expect(screen.queryByText('eng-runner')).toBeNull();
    expect(screen.queryByText('loop-a')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('shows the no-match message when the search matches nothing', async () => {
    useRunsHandler();
    const { queryClient } = renderList({ search: 'zzz-no-such-workflow' });

    expect(screen.getByText('No Workflows match your search')).not.toBeNull();

    await waitForMutationsIdle(queryClient);
  });
});
