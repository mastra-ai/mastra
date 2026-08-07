// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { DatasetItemPanel } from '../dataset-item-panel';
import { baseItem, itemWithMocks } from './fixtures/dataset-item-panel';

const BASE_URL = 'http://localhost:4111';

const renderPanel = (item: DatasetItem) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DatasetItemPanel datasetId="ds-1" item={item} items={[item]} onItemChange={() => {}} onClose={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('DatasetItemPanel view mode', () => {
  it('renders the Tool Mocks section in view mode when the item has mocks', () => {
    renderPanel(itemWithMocks);

    expect(screen.getByText('Tool Mocks')).not.toBeNull();
    expect(screen.getByText(/getWeather/)).not.toBeNull();
  });

  it('always renders the Tool Mocks section in view mode, even with no mocks', () => {
    renderPanel(baseItem);

    expect(screen.getByText('Tool Mocks')).not.toBeNull();
  });
});
