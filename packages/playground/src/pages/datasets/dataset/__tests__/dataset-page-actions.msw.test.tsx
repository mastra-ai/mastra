import type { DatasetItem, DatasetRecord, MastraClient } from '@mastra/client-js';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { DatasetPage } from '../index';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  DATASET_ID,
  dataset,
  items,
} from '@/domains/datasets/components/dataset-detail/__tests__/fixtures/dataset-items';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const newDataset: DatasetRecord = { ...dataset, version: 0 };

function mockDataset(
  record: DatasetRecord,
  datasetItems: DatasetItem[],
  versions: Awaited<ReturnType<MastraClient['listDatasetVersions']>>['versions'] = [],
) {
  const itemsResponse: Awaited<ReturnType<MastraClient['listDatasetItems']>> = {
    items: datasetItems,
    pagination: { total: datasetItems.length, page: 0, perPage: 10, hasMore: false },
  };
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([record]))),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(record)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, () => HttpResponse.json(itemsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/versions`, () =>
      HttpResponse.json({ versions, pagination: { total: versions.length, page: 0, perPage: 10, hasMore: false } }),
    ),
  );
}

function renderPage(search = '') {
  return renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route path="/datasets/:datasetId" element={<DatasetPage />} />
      </Routes>
    </TestLinkProvider>,
    { router: { initialEntries: [`/datasets/${DATASET_ID}${search}`] } },
  );
}

function getPageHeader() {
  return screen.getAllByRole('banner')[0];
}

function getBreadcrumb() {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

function getVersionCrumb(label: string) {
  return within(getBreadcrumb()).getByText(label, { ignore: '.sr-only' });
}

function openVersionSwitcher() {
  fireEvent.click(within(getBreadcrumb()).getByRole('combobox', { name: 'Switch dataset version' }));
}

const V1_CREATED_AT = '2026-10-01T09:00:00.000Z';
const V2_CREATED_AT = '2026-10-10T15:30:00.000Z';
const versionHistory = [
  { id: 'v2', datasetId: DATASET_ID, version: 2, createdAt: V2_CREATED_AT },
  { id: 'v1', datasetId: DATASET_ID, version: 1, createdAt: V1_CREATED_AT },
];

describe('DatasetPage', () => {
  describe('when the dataset has items', () => {
    it('renders the dataset actions in the page header', async () => {
      mockDataset(dataset, items);
      renderPage();

      const runButton = await screen.findByRole('button', { name: /new experiment/i });
      const header = getPageHeader();
      const link = within(header).getByRole('link', { name: 'Experiments' });

      expect(header.contains(runButton)).toBe(true);
      expect(link.getAttribute('href')).toBe(`/experiments?dataset=${DATASET_ID}`);
      expect(within(header).getByRole('button', { name: 'Dataset actions menu' })).toBeDefined();
    });

    it('shows the dataset name in the breadcrumb as a single switcher, not a link', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      const breadcrumb = getBreadcrumb();
      expect(within(breadcrumb).getByText(dataset.name, { ignore: '.sr-only' })).toBeDefined();
      expect(within(breadcrumb).queryByText(DATASET_ID, { ignore: '.sr-only' })).toBeNull();
      expect(within(breadcrumb).queryByRole('link', { name: dataset.name })).toBeNull();
      expect(within(breadcrumb).getByRole('combobox', { name: 'Switch dataset' })).toBeDefined();
    });

    it('lands on the latest version, shown in the breadcrumb', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      expect(getVersionCrumb('Latest (v1)').closest('[aria-current="page"]')).not.toBeNull();
      expect(within(getBreadcrumb()).getByRole('combobox', { name: 'Switch dataset version' })).toBeDefined();
      expect(screen.getAllByRole('combobox', { name: 'Switch dataset version' })).toHaveLength(1);
    });

    it('orders "New experiment" before "Experiments"', async () => {
      mockDataset(dataset, items);
      renderPage();

      const runButton = await screen.findByRole('button', { name: /new experiment/i });
      const link = within(getPageHeader()).getByRole('link', { name: 'Experiments' });

      expect(runButton.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('places the Schema action right after "Experiments"', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      const header = getPageHeader();
      const link = within(header).getByRole('link', { name: 'Experiments' });
      const schemaButton = within(header).getByRole('button', { name: 'Schema' });
      const menuButton = within(header).getByRole('button', { name: 'Dataset actions menu' });

      expect(link.compareDocumentPosition(schemaButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(schemaButton.compareDocumentPosition(menuButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('opens the dataset schema dialog from the Schema action', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      fireEvent.click(within(getPageHeader()).getByRole('button', { name: 'Schema' }));

      expect(await screen.findByRole('dialog', { name: 'Dataset schema' })).toBeDefined();
    });

    it('does not show when the dataset was created in the page header', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      expect(within(getPageHeader()).queryByText(/^Created/)).toBeNull();
    });

    it('keeps the toolbar free of page-level actions', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      const toolbar = screen.getByTestId('dataset-items-toolbar');
      expect(within(toolbar).queryByRole('link', { name: 'Experiments' })).toBeNull();
    });

    it('shows the tag editor', async () => {
      mockDataset(dataset, items);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      expect(screen.getByTestId('dataset-tags-editor')).toBeDefined();
    });
  });

  describe('when the dataset is new and empty', () => {
    it('only keeps the Schema action and the dataset menu in the header', async () => {
      mockDataset(newDataset, []);
      renderPage();
      await screen.findByText('No items yet');

      const header = getPageHeader();
      expect(within(header).getByRole('button', { name: 'Schema' })).toBeDefined();
      expect(within(header).getByRole('button', { name: 'Dataset actions menu' })).toBeDefined();
      expect(within(header).queryByText(/^Created/)).toBeNull();
      expect(screen.queryByRole('button', { name: /new experiment/i })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Experiments' })).toBeNull();
    });

    it('still shows the latest version in the breadcrumb', async () => {
      mockDataset(newDataset, []);
      renderPage();
      await screen.findByText('No items yet');

      expect(getVersionCrumb('Latest (v0)')).toBeDefined();
    });

    it('shows when the dataset was created under its only version', async () => {
      mockDataset(newDataset, []);
      renderPage();
      await screen.findByText('No items yet');

      openVersionSwitcher();

      const option = await screen.findByRole('option', { name: /^Latest \(v0\)/ });
      expect(within(option).getByText(`Created ${formatDate(newDataset.createdAt, 'date-time')}`)).toBeDefined();
    });

    it('hides the tag editor', async () => {
      mockDataset(newDataset, []);
      renderPage();
      await screen.findByText('No items yet');

      expect(screen.queryByTestId('dataset-tags-editor')).toBeNull();
    });
  });

  describe('when the dataset is empty but already tagged', () => {
    it('keeps the tag editor so existing tags stay visible', async () => {
      mockDataset({ ...newDataset, tags: ['prod'] }, []);
      renderPage();
      await screen.findByText('No items yet');

      expect(screen.getByTestId('dataset-tags-editor')).toBeDefined();
    });
  });

  describe('when the dataset is empty but has a version history', () => {
    it('keeps the experiments link, without "New experiment"', async () => {
      mockDataset(dataset, []);
      renderPage();
      await screen.findByText('No items yet');

      const header = getPageHeader();
      expect(within(header).getByRole('link', { name: 'Experiments' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /new experiment/i })).toBeNull();
    });
  });

  describe('when the URL points to an older version', () => {
    it('shows that version in the breadcrumb', async () => {
      mockDataset({ ...dataset, version: 2 }, items);
      renderPage('?version=1');
      await screen.findByRole('button', { name: /new experiment/i });

      expect(getVersionCrumb('v1')).toBeDefined();
    });
  });

  describe('when the version switcher is opened on a dataset with a version history', () => {
    it('shows when each version was created', async () => {
      mockDataset({ ...dataset, version: 2 }, items, versionHistory);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      openVersionSwitcher();

      const latest = await screen.findByRole('option', { name: /^Latest \(v2\)/ });
      const older = screen.getByRole('option', { name: /^v1/ });
      expect(within(latest).getByText(`Created ${formatDate(V2_CREATED_AT, 'date-time')}`)).toBeDefined();
      expect(within(older).getByText(`Created ${formatDate(V1_CREATED_AT, 'date-time')}`)).toBeDefined();
    });
  });

  describe('when another version is picked from the breadcrumb', () => {
    it('switches the breadcrumb to that version', async () => {
      mockDataset({ ...dataset, version: 2 }, items, versionHistory);
      renderPage();
      await screen.findByRole('button', { name: /new experiment/i });

      openVersionSwitcher();
      fireEvent.click(await screen.findByRole('option', { name: /^v1/ }));

      expect(await within(getBreadcrumb()).findByText('v1', { ignore: '.sr-only' })).toBeDefined();
    });
  });
});
