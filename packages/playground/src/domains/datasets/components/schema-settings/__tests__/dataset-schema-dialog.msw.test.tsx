import type { DatasetRecord, UpdateDatasetParams } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildDataset, buildFailingItemsError, cityInputSchema } from '../../__tests__/fixtures/datasets';
import { DatasetSchemaDialog } from '../dataset-schema-dialog';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@uiw/react-codemirror', () => import('@/test/mock-code-editor'));
vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

type UpdateBody = Omit<UpdateDatasetParams, 'datasetId'>;

function setupHandlers({ failingItems = 0 }: { failingItems?: number } = {}) {
  const updateBodies: UpdateBody[] = [];

  server.use(
    http.patch<{ datasetId: string }, UpdateBody>(`${TEST_BASE_URL}/api/datasets/:datasetId`, async ({ request }) => {
      updateBodies.push(await request.json());
      if (failingItems > 0) {
        return HttpResponse.json(buildFailingItemsError(failingItems), { status: 400 });
      }
      return HttpResponse.json(buildDataset());
    }),
  );

  return { updateBodies };
}

type DialogProps = ComponentProps<typeof DatasetSchemaDialog>;

async function renderDialog(dataset: DatasetRecord = buildDataset()) {
  const onOpenChange = vi.fn<DialogProps['onOpenChange']>();
  renderWithProviders(<DatasetSchemaDialog open onOpenChange={onOpenChange} dataset={dataset} />);
  await screen.findByRole('dialog', { name: 'Dataset schema' });
  return { onOpenChange };
}

const activePanel = () => within(screen.getByRole('tabpanel'));
const jsonEditor = () => activePanel().getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' });
const fieldNames = () => activePanel().queryAllByRole<HTMLInputElement>('textbox', { name: 'Field name' });
const typeJson = (value: string) => fireEvent.change(jsonEditor(), { target: { value } });
const openTab = async (name: string) => {
  fireEvent.click(screen.getByRole('tab', { name }));
  await waitFor(() => expect(screen.getAllByRole('tabpanel')).toHaveLength(1));
};
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Save schema' });

describe('DatasetSchemaDialog', () => {
  describe('when the dataset has no schema', () => {
    it('offers a tab for each schema', async () => {
      setupHandlers();
      await renderDialog();

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Input',
        'Ground truth',
        'Request context',
      ]);
    });

    it('leaves the JSON editor empty', async () => {
      setupHandlers();
      await renderDialog();

      expect(jsonEditor().value).toBe('');
    });

    it('does not offer to format the empty JSON', async () => {
      setupHandlers();
      await renderDialog();

      expect(activePanel().queryByRole('button', { name: 'Format JSON' })).toBeNull();
    });

    it('does not offer to copy the empty JSON', async () => {
      setupHandlers();
      await renderDialog();

      expect(activePanel().queryByRole('button', { name: 'Copy to clipboard' })).toBeNull();
    });

    it('saves every schema as null', async () => {
      const { updateBodies } = setupHandlers();
      await renderDialog();

      fireEvent.click(saveButton());

      await waitFor(() => expect(updateBodies).toHaveLength(1));
      expect(updateBodies[0]).toEqual({ inputSchema: null, groundTruthSchema: null, requestContextSchema: null });
    });
  });

  describe('when the dataset has an input schema', () => {
    it('lists its fields in the visual editor', async () => {
      setupHandlers();
      await renderDialog(buildDataset({ inputSchema: cityInputSchema }));

      expect(fieldNames().map(input => input.value)).toEqual(['city']);
    });

    it('shows it as JSON', async () => {
      setupHandlers();
      await renderDialog(buildDataset({ inputSchema: cityInputSchema }));

      expect(JSON.parse(jsonEditor().value)).toEqual(cityInputSchema);
    });

    it('offers to copy the JSON', async () => {
      setupHandlers();
      await renderDialog(buildDataset({ inputSchema: cityInputSchema }));

      expect(activePanel().getByRole('button', { name: 'Copy to clipboard' })).not.toBeNull();
    });
  });

  describe('when a field is added in the visual editor', () => {
    it('adds the property to the JSON', async () => {
      setupHandlers();
      await renderDialog();

      fireEvent.click(activePanel().getByRole('button', { name: 'Add field' }));
      fireEvent.change(fieldNames()[0], { target: { value: 'country' } });

      await waitFor(() =>
        expect(JSON.parse(jsonEditor().value)).toEqual({
          type: 'object',
          properties: { country: { type: 'string' } },
          required: ['country'],
        }),
      );
    });
  });

  describe('when valid JSON is typed', () => {
    const typedJson = JSON.stringify({ type: 'object', properties: { country: { type: 'string', enum: ['FR'] } } });

    it('shows its fields in the visual editor', async () => {
      setupHandlers();
      await renderDialog();

      typeJson(typedJson);

      await waitFor(() => expect(fieldNames().map(input => input.value)).toEqual(['country']));
    });

    it('keeps the JSON exactly as typed', async () => {
      setupHandlers();
      await renderDialog();

      typeJson(typedJson);

      await waitFor(() => expect(fieldNames()).toHaveLength(1));
      expect(jsonEditor().value).toBe(typedJson);
    });
  });

  describe('when the typed JSON is formatted', () => {
    const compactJson = JSON.stringify({
      type: 'object',
      properties: { country: { type: 'string', description: 'ISO country code of the destination' } },
      required: ['country'],
    });

    it('rewrites the JSON over several lines', async () => {
      setupHandlers();
      await renderDialog();
      typeJson(compactJson);

      fireEvent.click(activePanel().getByRole('button', { name: 'Format JSON' }));

      await waitFor(() => expect(jsonEditor().value.split('\n').length).toBeGreaterThan(1));
      expect(JSON.parse(jsonEditor().value)).toEqual(JSON.parse(compactJson));
    });
  });

  describe('when invalid JSON is typed', () => {
    it('explains the JSON is invalid', async () => {
      setupHandlers();
      await renderDialog();

      typeJson('{ "type": ');

      expect(activePanel().getByText('Invalid JSON')).not.toBeNull();
    });

    it('disables saving', async () => {
      setupHandlers();
      await renderDialog();

      typeJson('{ "type": ');

      expect(saveButton().disabled).toBe(true);
    });
  });

  describe('when the JSON is not a valid JSON Schema', () => {
    const misspelledType = JSON.stringify({ type: 'object', properties: { city: { type: 'strnig' } } });

    it('points to the invalid keyword', async () => {
      setupHandlers();
      await renderDialog();

      typeJson(misspelledType);

      expect(
        activePanel().getByText(
          'Invalid JSON Schema: /properties/city/type must be equal to one of the allowed values',
        ),
      ).not.toBeNull();
    });

    it('disables saving', async () => {
      setupHandlers();
      await renderDialog();

      typeJson(misspelledType);

      expect(saveButton().disabled).toBe(true);
    });

    it('keeps the visual editor on the last valid schema', async () => {
      setupHandlers();
      await renderDialog(buildDataset({ inputSchema: cityInputSchema }));

      typeJson(JSON.stringify({ type: 'object', properties: { country: { type: 'strnig' } } }));

      expect(fieldNames().map(input => input.value)).toEqual(['city']);
    });
  });

  describe('when the JSON declares the draft-07 meta-schema', () => {
    it('allows saving', async () => {
      setupHandlers();
      await renderDialog();

      typeJson(
        JSON.stringify({
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { email: { type: 'string', format: 'email', minLength: 3 } },
        }),
      );

      await waitFor(() => expect(fieldNames()).toHaveLength(1));
      expect(saveButton().disabled).toBe(false);
    });
  });

  describe('when schemas are edited across tabs and saved', () => {
    it('sends every edited schema', async () => {
      const { updateBodies } = setupHandlers();
      await renderDialog(buildDataset({ inputSchema: cityInputSchema }));

      await openTab('Ground truth');
      typeJson('{"type":"object","properties":{"answer":{"type":"string"}}}');
      fireEvent.click(saveButton());

      await waitFor(() => expect(updateBodies).toHaveLength(1));
      expect(updateBodies[0]).toEqual({
        inputSchema: cityInputSchema,
        groundTruthSchema: { type: 'object', properties: { answer: { type: 'string' } } },
        requestContextSchema: null,
      });
    });

    it('closes the dialog', async () => {
      setupHandlers();
      const { onOpenChange } = await renderDialog();

      fireEvent.click(saveButton());

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });

  describe('when existing items fail validation', () => {
    it('reports how many items fail', async () => {
      setupHandlers({ failingItems: 2 });
      await renderDialog();

      fireEvent.click(saveButton());

      expect((await screen.findByRole('alert')).textContent).toContain('2 existing item(s) fail validation');
    });

    it('keeps the dialog open', async () => {
      const { updateBodies } = setupHandlers({ failingItems: 2 });
      const { onOpenChange } = await renderDialog();

      fireEvent.click(saveButton());

      await screen.findByRole('alert');
      expect(updateBodies).toHaveLength(1);
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
