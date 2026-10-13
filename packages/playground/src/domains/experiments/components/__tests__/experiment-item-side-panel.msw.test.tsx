import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentItemSidePanel } from '../experiment-item-side-panel';
import { agentMarkdownResult, workflowResult } from './fixtures/experiment-results';
import { noScorers } from './fixtures/target-registries';
import { StudioFrame } from '@/components/layout';
import { dataset } from '@/domains/datasets/components/datasets-list/__tests__/fixtures/datasets';
import { emptyScoresResponse } from '@/domains/experiments/__tests__/fixtures/experiment-item-route';
import {
  ExperimentItemPanelProvider,
  useExperimentItemPanel,
} from '@/domains/experiments/context/experiment-item-panel-context';
import { RouteSidePanelProvider } from '@/lib/route-side-panel';
import { metricsUnavailableCapabilities } from '@/pages/traces/__tests__/fixtures/traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const mobileState = vi.hoisted(() => ({ value: false }));
const handleSpy = vi.hoisted(() => ({ collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() }));

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ id, children }: { id?: string; children: ReactNode }) => (
    <section data-testid={`panel-${id}`}>{children}</section>
  ),
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChange: vi.fn() }),
}));

vi.mock('@mastra/playground-ui/resize/collapsible-panel', () => ({
  CollapsiblePanel: ({
    id,
    children,
    ref,
  }: {
    id: string;
    children: ReactNode;
    ref?: { current: typeof handleSpy | null };
  }) => {
    if (ref) ref.current = handleSpy;
    return <section data-testid={`collapsible-${id}`}>{children}</section>;
  },
}));

vi.mock('@mastra/playground-ui/resize/separator', () => ({
  PanelSeparator: () => <div data-testid="panel-separator" />,
}));

vi.mock('@mastra/playground-ui/resize/panel-drawer', () => ({
  PanelDrawer: ({ children }: { children: ReactNode }) => <aside data-testid="panel-drawer">{children}</aside>,
}));

vi.mock('@mastra/playground-ui/hooks/use-is-mobile', () => ({
  useIsMobile: () => mobileState.value,
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

function OpenItemButton() {
  const { openItem } = useExperimentItemPanel();
  return (
    <button type="button" onClick={() => openItem(agentMarkdownResult.itemId)}>
      open item
    </button>
  );
}

function renderExperimentPage(initialPath: string) {
  return renderWithProviders(
    <TestLinkProvider>
      <RouteSidePanelProvider>
        <ExperimentItemPanelProvider
          experimentId="exp-1"
          datasetId="ds-1"
          experimentStatus="completed"
          results={[agentMarkdownResult, workflowResult]}
          isLoadingResults={false}
        >
          <StudioFrame>
            <OpenItemButton />
          </StudioFrame>
          <ExperimentItemSidePanel withQueryTrace={false} withFeedback={false} />
          <LocationProbe />
        </ExperimentItemPanelProvider>
      </RouteSidePanelProvider>
    </TestLinkProvider>,
    { router: { initialEntries: [initialPath] } },
  );
}

const itemPath = `/experiments/exp-1/items/${agentMarkdownResult.itemId}`;

const findInlineResult = async () => {
  const sidePanel = await screen.findByTestId('collapsible-route-side-panel');
  await waitFor(() => expect(sidePanel.querySelector('[data-slot="data-panel"]')).not.toBeNull());
  return sidePanel.querySelector('[data-slot="data-panel"]');
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () => HttpResponse.json(emptyScoresResponse)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/datasets/ds-1`, () => HttpResponse.json(dataset('ds-1', 'Support questions'))),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () =>
      HttpResponse.json(metricsUnavailableCapabilities),
    ),
  );
});

afterEach(() => {
  mobileState.value = false;
  vi.clearAllMocks();
});

describe('ExperimentItemSidePanel', () => {
  describe('when an item is selected', () => {
    it('renders the result as an inline panel in the route side panel', async () => {
      renderExperimentPage(itemPath);

      const result = await findInlineResult();

      expect(result?.getAttribute('data-variant')).toBe('inline');
    });

    it('keeps the result outside the studio frame and out of a modal dialog', async () => {
      renderExperimentPage(itemPath);

      await findInlineResult();

      expect(screen.getByTestId('panel-studio-frame').querySelector('[data-slot="data-panel"]')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the side panel', async () => {
      renderExperimentPage(itemPath);

      await findInlineResult();

      await waitFor(() => expect(handleSpy.expand).toHaveBeenCalled());
    });
  });

  describe('when no item is selected', () => {
    it('does not mount the side panel', async () => {
      renderExperimentPage('/experiments/exp-1');

      await screen.findByText('open item');

      expect(screen.queryByTestId('collapsible-route-side-panel')).toBeNull();
    });
  });

  describe('when the item is closed', () => {
    it('navigates back to the experiment and unmounts the side panel', async () => {
      renderExperimentPage(itemPath);
      await findInlineResult();

      fireEvent.click(screen.getByRole('button', { name: 'Close Panel' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/experiments/exp-1'));
      expect(screen.queryByTestId('collapsible-route-side-panel')).toBeNull();
    });
  });

  describe('when on mobile', () => {
    it('renders the result as a drawer instead of a side panel', async () => {
      mobileState.value = true;
      renderExperimentPage(itemPath);

      expect(await screen.findByRole('dialog')).toBeTruthy();
      expect(screen.queryByTestId('panel-drawer')).toBeNull();
    });
  });
});
