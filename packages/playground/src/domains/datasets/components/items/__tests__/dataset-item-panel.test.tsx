// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatasetItemPanel } from '../dataset-item-panel';
import { baseItem, itemWithMocks, itemWithScorers, itemWithUuid } from './fixtures/dataset-item-panel';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Panel children render links through the framework Link (null by default).
const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const renderPanel = (item: DatasetItem, navigate: (path: string) => void = () => {}) => {
  // The panel embeds CompareWithList, which fetches the dataset's items.
  server.use(
    http.get(`${BASE_URL}/api/datasets/ds-1/items`, () =>
      HttpResponse.json({ items: [], pagination: { total: 0, page: 0, perPage: 10 } }),
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={navigate} paths={{} as never}>
          <MemoryRouter>
            <DatasetItemPanel datasetId="ds-1" item={item} items={[item]} onItemChange={() => {}} onClose={() => {}} />
          </MemoryRouter>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const enterEditMode = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Open actions menu' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
};

afterEach(() => cleanup());

describe('DatasetItemPanel', () => {
  describe('when item details are viewed', () => {
    it('renders persisted tool mocks', () => {
      renderPanel(itemWithMocks);

      expect(screen.getByText('Tool Mocks')).not.toBeNull();
      expect(screen.getByText(/getWeather/)).not.toBeNull();
    });

    it('keeps the versions history out of the header', () => {
      renderPanel(baseItem);

      expect(screen.queryByRole('link', { name: 'Go to item versions history' })).toBeNull();
    });

    it('opens the versions history from the actions menu, with the item version pre-selected', async () => {
      const navigate = vi.fn();
      renderPanel(baseItem, navigate);

      fireEvent.click(screen.getByRole('button', { name: 'Open actions menu' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Item versions' }));

      expect(navigate).toHaveBeenCalledWith(`/datasets/ds-1/items/${baseItem.id}/versions?version=1`);
    });

    it('leaves out the scorers section', () => {
      renderPanel(itemWithScorers);

      expect(screen.queryByText('Scorers')).toBeNull();
    });

    it('titles the panel like experiment results, without the id', () => {
      renderPanel(itemWithUuid);

      expect(screen.getByText('Dataset item')).not.toBeNull();
      expect(screen.queryByRole('button', { name: /^0bbd9730-e38/ })).toBeNull();
    });

    it('leaves out the dataset id and version rows', () => {
      renderPanel(baseItem);

      expect(screen.queryByText('Dataset Id')).toBeNull();
      expect(screen.queryByText('Version')).toBeNull();
    });
  });

  describe('when an item is edited', () => {
    it('does not offer a scorer override', async () => {
      renderPanel(baseItem);
      await enterEditMode();

      expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeNull();
      expect(screen.queryByRole('switch', { name: 'Override dataset scorers' })).toBeNull();
    });
  });

  describe('when an item with a scorer override is edited', () => {
    it('saves without touching its scorers', async () => {
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json({ ...itemWithScorers, datasetVersion: 2 });
        }),
      );
      renderPanel(itemWithScorers);
      await enterEditMode();

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).not.toHaveProperty('scorerIds');
    });
  });
});
