import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetVersions } from '../dataset-versions';
import { datasetVersionsResponse } from './fixtures/dataset-versions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui/components/Combobox', () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
  }: {
    options: Array<{ label: string; value: string }>;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select value={value} onChange={event => onValueChange?.(event.target.value)}>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

afterEach(cleanup);

function renderVersions(props: Partial<ComponentProps<typeof DatasetVersions>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onValueChange = vi.fn();

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <DatasetVersions
          datasetId="dataset-1"
          value={null}
          onValueChange={onValueChange}
          currentVersion={12}
          {...props}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { onValueChange };
}

describe('DatasetVersions', () => {
  it('labels the current version as Latest and selects an older dataset version', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/versions`, () => HttpResponse.json(datasetVersionsResponse)),
    );
    const { onValueChange } = renderVersions();

    expect(await screen.findByRole('option', { name: 'Latest (v12)' })).toBeDefined();
    await waitFor(() => expect(screen.getByRole('option', { name: 'v11' })).toBeDefined());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '11' } });
    expect(onValueChange).toHaveBeenCalledWith(11);
  });

  it('clears the explicit version when Latest is selected', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/versions`, () => HttpResponse.json(datasetVersionsResponse)),
    );
    const { onValueChange } = renderVersions({ value: 11 });

    await screen.findByRole('option', { name: 'Latest (v12)' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '12' } });

    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
