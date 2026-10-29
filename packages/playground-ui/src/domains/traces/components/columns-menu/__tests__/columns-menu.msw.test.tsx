// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse, GetTraceQueryFieldsResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TRACE_COLUMN_PREFERENCES, TRACE_COLUMN_CATALOGS } from '../../../trace-list-columns';
import type { TraceColumnPreferences } from '../../../trace-list-columns';
import { ColumnsMenu } from '../columns-menu';
import type { ColumnsMenuProps } from '../columns-menu';
import {
  allCapabilities,
  discoveryUnsupportedError,
  nestedMetadataFields,
  noSpanQueryCapabilities,
  noTimeToFirstChunkCapabilities,
  noTraceQueryCapabilities,
} from './fixtures/columns-menu';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const onChange = vi.fn<(next: TraceColumnPreferences) => void>();
const onFieldsRequest = vi.fn<(body: unknown) => void>();

const METRICS_SUPPORTED = { supported: true, isLoading: false };

type HandlerOptions = {
  capabilities?: GetObservabilityCapabilitiesResponse;
  capabilitiesDelayMs?: number;
  fields?: GetTraceQueryFieldsResponse | 'unsupported';
};

const setHandlers = ({
  capabilities = allCapabilities,
  capabilitiesDelayMs,
  fields = nestedMetadataFields,
}: HandlerOptions = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, async () => {
      if (capabilitiesDelayMs) await delay(capabilitiesDelayMs);
      return HttpResponse.json(capabilities);
    }),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, async ({ request }) => {
      onFieldsRequest(await request.json());
      if (fields === 'unsupported') return HttpResponse.json(discoveryUnsupportedError, { status: 501 });
      return HttpResponse.json(fields);
    }),
  );
};

/** A host that owns the selection, like the explorers do. */
function Host(props: Partial<ColumnsMenuProps>) {
  const [value, setValue] = useState<TraceColumnPreferences>(DEFAULT_TRACE_COLUMN_PREFERENCES);
  return (
    <ColumnsMenu
      scope="traces"
      value={value}
      onChange={next => {
        onChange(next);
        setValue(next);
      }}
      metricsSupport={METRICS_SUPPORTED}
      {...props}
    />
  );
}

const renderMenu = (props: Partial<ColumnsMenuProps> = {}) => renderWithProviders(<Host {...props} />);

const columnsButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Columns' });

const openMenuWhenReady = async () => {
  await waitFor(() => expect(columnsButton().disabled).toBe(false));
  fireEvent.click(columnsButton());
};

const openMetadataKeyList = async () => {
  await openMenuWhenReady();
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Metadata key' }));
};

const optionNames = () => screen.queryAllByRole('option').map(option => option.textContent);

describe('ColumnsMenu', () => {
  beforeEach(() => {
    onChange.mockReset();
    onFieldsRequest.mockReset();
  });

  describe('when the scope is threads', () => {
    it('renders nothing and asks the server for nothing', async () => {
      // No handlers: MSW fails any request, so a capability or discovery call would throw.
      const { container } = renderMenu({ scope: 'threads' });

      expect(container.innerHTML).toBe('');
      expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull();
    });
  });

  describe('when capabilities are still loading', () => {
    it('keeps the Columns button in place but disabled until they arrive', async () => {
      setHandlers({ capabilitiesDelayMs: 50 });
      renderMenu();

      expect(columnsButton().disabled).toBe(true);
      await waitFor(() => expect(columnsButton().disabled).toBe(false));
    });
  });

  describe('when the user toggles a column', () => {
    it('hands the host the whole next selection', async () => {
      setHandlers();
      renderMenu();

      await openMenuWhenReady();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Duration' }));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_TRACE_COLUMN_PREFERENCES,
        visibleColumns: DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns.filter(column => column !== 'duration'),
      });
    });

    it('hands the host the defaults on reset', async () => {
      setHandlers();
      renderMenu({ value: { visibleColumns: ['input'], customColumns: ['threadId'], metadataKeys: ['tenant'] } });

      await openMenuWhenReady();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));

      expect(onChange).toHaveBeenCalledWith(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });
  });

  describe('when traces carry nested metadata', () => {
    it('offers each top-level key once, sorted', async () => {
      setHandlers();
      renderMenu();

      await openMetadataKeyList();

      await waitFor(() => expect(optionNames()).toEqual(['region', 'tenant']));
    });

    it('adds the picked key as a metadata column', async () => {
      setHandlers();
      renderMenu();

      await openMetadataKeyList();
      const option = await screen.findByRole('option', { name: 'tenant' });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_TRACE_COLUMN_PREFERENCES, metadataKeys: ['tenant'] });
    });

    it('discovers keys at trace scope', async () => {
      setHandlers();
      renderMenu();

      await waitFor(() => expect(onFieldsRequest).toHaveBeenCalled());
      expect(onFieldsRequest.mock.calls[0]?.[0]).toMatchObject({ predicateScope: 'trace' });
    });
  });

  describe('when the store does not support discovery', () => {
    it('still lets the user type a key', async () => {
      setHandlers({ fields: 'unsupported' });
      renderMenu();

      await openMetadataKeyList();
      await userEvent.keyboard('tenant');

      expect(await screen.findByRole('option', { name: 'Use “tenant”' })).toBeTruthy();
    });
  });

  describe('when the trace query API is unavailable', () => {
    it('does not offer metadata columns and does not run discovery', async () => {
      setHandlers({ capabilities: noTraceQueryCapabilities });
      renderMenu();

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Add metadata column' })).toBeNull();
      expect(onFieldsRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the host turns the query API off', () => {
    it('does not offer metadata columns and does not run discovery', async () => {
      setHandlers();
      renderMenu({ queryEnabled: false });

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Add metadata column' })).toBeNull();
      expect(onFieldsRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the scope is spans', () => {
    it('offers the span columns, including model and provider', async () => {
      setHandlers();
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Model' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Provider' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Trace ID' })).toBeTruthy();
    });

    it('offers neither usage nor metadata columns, and runs no discovery', async () => {
      setHandlers();
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Input tokens' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Add metadata column' })).toBeNull();
      expect(onFieldsRequest).not.toHaveBeenCalled();
    });

    it('hands the host the span defaults on reset', async () => {
      setHandlers();
      renderMenu({
        scope: 'spans',
        value: { visibleColumns: ['model'], customColumns: ['traceId'], metadataKeys: [] },
      });

      await openMenuWhenReady();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));

      expect(onChange).toHaveBeenCalledWith(TRACE_COLUMN_CATALOGS.spans.defaults);
    });

    it('waits for the span query capability before enabling the trigger', async () => {
      setHandlers({ capabilities: noSpanQueryCapabilities, capabilitiesDelayMs: 50 });
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      expect(columnsButton().disabled).toBe(true);
      await waitFor(() => expect(columnsButton().disabled).toBe(false));
    });
  });

  describe('time to first chunk column', () => {
    it('offers it when the store records it, and hands the host the selection with it', async () => {
      setHandlers();
      renderMenu();

      await openMenuWhenReady();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Time to first chunk' }));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_TRACE_COLUMN_PREFERENCES,
        visibleColumns: [...DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns, 'timeToFirstChunk'],
      });
    });

    it('does not offer it when the store does not record it', async () => {
      setHandlers({ capabilities: noTimeToFirstChunkCapabilities });
      renderMenu();

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Time to first chunk' })).toBeNull();
    });

    it('does not offer it without the trace query API, whose rows are the only ones that carry it', async () => {
      setHandlers();
      renderMenu({ queryEnabled: false });

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Time to first chunk' })).toBeNull();
    });

    it('is not a span column', async () => {
      setHandlers();
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      await openMenuWhenReady();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Time to first chunk' })).toBeNull();
    });
  });

  describe('usage columns', () => {
    it('disables them and says why when the store has no metrics', async () => {
      setHandlers();
      renderMenu({ metricsSupport: { supported: false, isLoading: false } });

      await openMenuWhenReady();

      const inputTokens = await screen.findByRole('menuitemcheckbox', { name: 'Input tokens' });
      expect(inputTokens.getAttribute('data-disabled')).not.toBeNull();
      expect(screen.getByRole('note').textContent).toBe(
        'This observability store does not support token and cost metrics.',
      );
    });

    it('says support is being checked while metrics support loads', async () => {
      setHandlers();
      renderMenu({ metricsSupport: { supported: false, isLoading: true } });

      await openMenuWhenReady();

      expect(await screen.findByText('Checking whether this storage supports usage data.')).toBeTruthy();
    });

    it('treats usage as unsupported when the host does not say', async () => {
      setHandlers();
      renderMenu({ metricsSupport: undefined });

      await openMenuWhenReady();

      expect(await screen.findByText('This observability store does not support token and cost metrics.')).toBeTruthy();
    });
  });
});
