import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ItemDetailDialog } from '../item-detail-dialog';
import { DATASET_ID, items } from './fixtures/dataset-items';
import { successfulPurgeDatasetItemResponse } from '@/domains/datasets/hooks/__tests__/fixtures/dataset-mutations';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

describe('ItemDetailDialog', () => {
  describe('when item data is being purged', () => {
    it('keeps the confirmation open and shows the pending state', async () => {
      let resolveRequest: (() => void) | undefined;
      server.use(
        http.delete(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items/${items[0].id}/purge`, async () => {
          await new Promise<void>(resolve => {
            resolveRequest = resolve;
          });
          return HttpResponse.json(successfulPurgeDatasetItemResponse);
        }),
      );

      renderWithProviders(
        <ItemDetailDialog
          datasetId={DATASET_ID}
          item={items[0]}
          items={items}
          isOpen
          onClose={vi.fn()}
          onItemChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Purge Data' }));
      const confirmation = await screen.findByRole('alertdialog');
      const observeDefault = vi.fn((event: MouseEvent) => event.defaultPrevented);
      document.addEventListener('click', observeDefault);
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Purge Data' }));
      document.removeEventListener('click', observeDefault);

      expect(observeDefault).toHaveReturnedWith(true);
      expect((await within(confirmation).findByRole('button', { name: 'Purging...' })).hasAttribute('disabled')).toBe(
        true,
      );
      expect(screen.getByRole('alertdialog')).toBe(confirmation);

      await waitFor(() => expect(resolveRequest).toBeTypeOf('function'));
      resolveRequest?.();
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });
  });
});
