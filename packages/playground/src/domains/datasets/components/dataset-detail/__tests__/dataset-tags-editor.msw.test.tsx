import type { DatasetRecord, UpdateDatasetParams } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DatasetTagsEditor } from '../dataset-tags-editor';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { expectComputedTag, expectInheritsTagForeground } from '@/test/computed-tag';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const DATASET_ID = 'ds-tags';

let current: DatasetRecord;
let patchBodies: Array<Omit<UpdateDatasetParams, 'datasetId'>>;

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

beforeEach(() => {
  current = buildDataset({ id: DATASET_ID, name: 'Tagged', tags: ['alpha'] });
  patchBodies = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(
        buildListDatasetsResponse([
          current,
          buildDataset({ id: 'ds-other-1', name: 'Other 1', tags: ['beta', 'gamma'] }),
          buildDataset({ id: 'ds-other-2', name: 'Other 2', tags: ['beta'] }),
        ]),
      ),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(current)),
    http.patch(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, async ({ request }) => {
      const body = (await request.json()) as Omit<UpdateDatasetParams, 'datasetId'>;
      patchBodies.push(body);
      current = { ...current, ...body };
      return HttpResponse.json(current);
    }),
  );
});

function renderEditor() {
  return renderWithProviders(<DatasetTagsEditor datasetId={DATASET_ID} />);
}

async function openCombobox() {
  const trigger = await screen.findByRole('combobox');
  expect(trigger.textContent).toContain('Add tag');
  fireEvent.click(trigger);
  return screen.findByPlaceholderText('Search or create tag...');
}

function selectOption(option: HTMLElement) {
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

describe('DatasetTagsEditor', () => {
  describe('given a dataset tagged "alpha" among datasets tagged "beta" and "gamma"', () => {
    it('renders the current tags as removable badges', async () => {
      renderEditor();

      const remove = await screen.findByRole('button', { name: 'Remove tag alpha' });
      const editor = screen.getByTestId('dataset-tags-editor');
      expect(editor.contains(remove)).toBe(true);
      expect(editor.textContent).toContain('alpha');
    });

    it('renders each current tag with colors computed from its value', async () => {
      renderEditor();

      const remove = await screen.findByRole('button', { name: 'Remove tag alpha' });
      expectComputedTag(remove.parentElement, 'alpha');
    });

    it('renders the remove action in the tag foreground color with a pointer cursor', async () => {
      renderEditor();

      expectInheritsTagForeground(await screen.findByRole('button', { name: 'Remove tag alpha' }));
    });

    it('lists every known tag and marks the ones already on the dataset', async () => {
      renderEditor();
      await screen.findByRole('button', { name: 'Remove tag alpha' });

      await openCombobox();

      await screen.findByRole('option', { name: 'beta' });
      const options = screen.getAllByRole('option');
      expect(options.map(o => o.textContent)).toEqual(['alpha', 'beta', 'gamma']);
      expect(within(options[0]).queryByTestId('tag-applied')).not.toBeNull();
      expect(within(options[1]).queryByTestId('tag-applied')).toBeNull();
    });

    it('does nothing when a tag already on the dataset is selected', async () => {
      renderEditor();
      await screen.findByRole('button', { name: 'Remove tag alpha' });

      await openCombobox();
      selectOption(await screen.findByRole('option', { name: 'alpha' }));

      await waitFor(() => {
        expect(screen.queryByRole('option')).toBeNull();
      });
      expect(patchBodies).toEqual([]);
      expect(screen.getByRole('button', { name: 'Remove tag alpha' })).toBeDefined();
    });

    it('offers to create an unknown tag as the first option and persists it on select', async () => {
      renderEditor();
      await screen.findByRole('button', { name: 'Remove tag alpha' });

      const search = await openCombobox();
      fireEvent.input(search, { target: { value: 'new-tag' }, inputType: 'insertText' });

      const create = await screen.findByRole('option', { name: 'Create "new-tag"' });
      expect(screen.getAllByRole('option')[0]).toBe(create);

      selectOption(create);

      await waitFor(() => {
        expect(patchBodies).toEqual([{ tags: ['alpha', 'new-tag'] }]);
      });
      await screen.findByRole('button', { name: 'Remove tag new-tag' });
    });

    it('adds an existing tag on select', async () => {
      renderEditor();
      await screen.findByRole('button', { name: 'Remove tag alpha' });

      await openCombobox();
      selectOption(await screen.findByRole('option', { name: 'beta' }));

      await waitFor(() => {
        expect(patchBodies).toEqual([{ tags: ['alpha', 'beta'] }]);
      });
      await screen.findByRole('button', { name: 'Remove tag beta' });
    });

    it('removes a tag when its remove button is clicked', async () => {
      renderEditor();

      fireEvent.click(await screen.findByRole('button', { name: 'Remove tag alpha' }));

      await waitFor(() => {
        expect(patchBodies).toEqual([{ tags: [] }]);
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Remove tag alpha' })).toBeNull();
      });
    });

    it('does not offer to create a tag that already exists', async () => {
      renderEditor();
      await screen.findByRole('button', { name: 'Remove tag alpha' });

      const search = await openCombobox();
      fireEvent.input(search, { target: { value: 'beta' }, inputType: 'insertText' });

      await screen.findByRole('option', { name: 'beta' });
      expect(screen.queryByRole('option', { name: /Create/ })).toBeNull();
    });
  });
});
