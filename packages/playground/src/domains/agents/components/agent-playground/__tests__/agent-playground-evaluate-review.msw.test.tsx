import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import type { LoaderFunctionArgs, RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import { PlaygroundModelProvider } from '../../../context/playground-model-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { AgentPlaygroundEvaluate } from '../agent-playground-evaluate';
import { routes } from '@/App';
import { GenerationProvider } from '@/domains/datasets/context/generation-context';
import { emptyReviewSummary } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function Harness() {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Chef Agent',
      instructions: 'Cook well.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      tools: {},
    },
  });

  return (
    <AgentEditFormProvider form={form} mode="edit" isSubmitting={false} handlePublish={async () => {}}>
      <PlaygroundModelProvider>
        <GenerationProvider>
          <AgentPlaygroundEvaluate agentId="chef-agent" />
        </GenerationProvider>
      </PlaygroundModelProvider>
    </AgentEditFormProvider>
  );
}

const emptyList = { pagination: { total: 0, page: 0, perPage: 100, hasMore: false } };

const setupHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets: [], ...emptyList })),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, () =>
      HttpResponse.json({ experiments: [], ...emptyList }),
    ),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json({ experiments: [], ...emptyList })),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
  );
};

describe('AgentPlaygroundEvaluate review sub-tab', () => {
  it('renders Review as a sub-tab and opens it from ?tab=review with an empty state', async () => {
    setupHandlers();
    renderWithProviders(<Harness />, { router: { initialEntries: ['/agents/chef-agent/evaluate?tab=review'] } });

    const reviewTab = await screen.findByRole('tab', { name: 'Review' });
    expect(reviewTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Experiments' }).getAttribute('aria-selected')).toBe('false');

    expect(await screen.findByText('No items to review')).not.toBeNull();
  });

  it('shows the same empty states as the Experiments, Datasets and Scorers pages', async () => {
    setupHandlers();
    renderWithProviders(<Harness />, { router: true });

    expect(await screen.findByText('No Experiments yet')).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
    expect(await screen.findByText('No Datasets yet')).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Scorers' }));
    expect(await screen.findByText('No Scorers yet')).not.toBeNull();
  });

  it('falls back to Experiments for an unknown ?tab value', async () => {
    setupHandlers();
    renderWithProviders(<Harness />, { router: { initialEntries: ['/agents/chef-agent/evaluate?tab=nope'] } });

    const experimentsTab = await screen.findByRole('tab', { name: 'Experiments' });
    expect(experimentsTab.getAttribute('aria-selected')).toBe('true');
  });

  it('places Run options on the sub-tab row, in the same row as the sub-tabs', async () => {
    setupHandlers();
    renderWithProviders(<Harness />, { router: true });

    const trigger = await screen.findByTestId('agent-top-bar-run-options-trigger');
    const tablist = screen.getByRole('tablist');
    // Both sit in the same flex row: the tab list on the left, actions on the right.
    const row = trigger.closest('.justify-between')!;
    expect(row).not.toBeNull();
    expect(row.contains(tablist)).toBe(true);
    // Run options is the last action so it stays far right on every sub-tab.
    const actions = trigger.parentElement!;
    expect(actions.lastElementChild).toBe(trigger);

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Review' }).getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByTestId('agent-top-bar-run-options-trigger')).not.toBeNull();
  });
});

describe('/agents/:agentId/review route', () => {
  it('redirects to the Review sub-tab of Evals', async () => {
    const findRoute = (list: RouteObject[], predicate: (r: RouteObject) => boolean): RouteObject | undefined => {
      for (const route of list) {
        if (predicate(route)) return route;
        const nested = route.children ? findRoute(route.children, predicate) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };

    const agentRoute = findRoute(routes, r => r.path === '/agents/:agentId');
    const reviewRoute = findRoute(agentRoute?.children ?? [], r => r.path === 'review');
    expect(reviewRoute?.element).toBeUndefined();
    expect(typeof reviewRoute?.loader).toBe('function');

    const response = (await (reviewRoute!.loader as (args: LoaderFunctionArgs) => unknown)({
      params: { agentId: 'chef-agent' },
      request: new Request('http://localhost/agents/chef-agent/review'),
      context: {},
    } as LoaderFunctionArgs)) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/agents/chef-agent/evaluate?tab=review');
  });
});
