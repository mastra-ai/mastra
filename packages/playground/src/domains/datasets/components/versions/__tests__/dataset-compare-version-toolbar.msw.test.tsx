import '@/test/english-locale';
import type { MastraClient } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { datasetVersionsResponse } from '../../__tests__/fixtures/dataset-versions';
import { DatasetCompareVersionToolbar } from '../dataset-compare-version-toolbar';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type DatasetVersionsResponse = Awaited<ReturnType<MastraClient['listDatasetVersions']>>;
const versions: DatasetVersionsResponse = datasetVersionsResponse;

beforeEach(() => {
  server.use(http.get(`${TEST_BASE_URL}/api/datasets/dataset-1/versions`, () => HttpResponse.json(versions)));
});

function renderToolbar() {
  const onVersionChange = vi.fn<(versionA: string, versionB: string) => void>();
  renderWithProviders(
    <DatasetCompareVersionToolbar
      datasetId="dataset-1"
      versionA="12"
      versionB="11"
      onVersionChange={onVersionChange}
    />,
  );
  return onVersionChange;
}

describe('DatasetCompareVersionToolbar', () => {
  describe('when both versions are selected before either menu opens', () => {
    it('shows readable plain-text labels with the current marker on the latest version', async () => {
      renderToolbar();

      const versionA = screen.getByRole('combobox', { name: 'Version A' });
      const versionB = screen.getByRole('combobox', { name: 'Version B' });
      await waitFor(() => expect(versionA.textContent).toMatch(/^v12 .+2026.+ \(current\)$/));
      expect(versionB.textContent).toMatch(/^v11 .+2026/);
      expect(versionB.textContent).not.toContain('(current)');
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('when a version menu opens', () => {
    it.each([
      { name: 'Version A', selected: 'v11', expected: ['11', '11'] },
      { name: 'Version B', selected: 'v12', expected: ['12', '12'] },
    ])('keeps separate menu fields and changes only $name', async ({ name, selected, expected }) => {
      const onVersionChange = renderToolbar();
      const trigger = screen.getByRole('combobox', { name });
      await waitFor(() => expect(trigger.textContent).toContain('2026'));
      fireEvent.click(trigger);

      const menu = await screen.findByRole('listbox');
      const latest = within(menu).getByRole('option', { name: /^v12/ });
      const earlier = within(menu).getByRole('option', { name: /^v11/ });
      expect(within(latest).getByText('v12')).toBeDefined();
      expect(within(latest).getByText('(current)')).toBeDefined();
      expect(within(latest).getByText(/2026/)).toBeDefined();
      expect(within(earlier).getByText('v11')).toBeDefined();
      expect(within(earlier).getByText(/2026/)).toBeDefined();

      const option = selected === 'v12' ? latest : earlier;
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });

      await waitFor(() => expect(onVersionChange).toHaveBeenCalledExactlyOnceWith(...expected));
    });
  });
});
