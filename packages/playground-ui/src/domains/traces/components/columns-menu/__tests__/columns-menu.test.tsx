// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TRACE_COLUMN_PREFERENCES, TRACE_COLUMN_CATALOGS } from '../../../trace-list-columns';
import type { TraceColumnPreferences } from '../../../trace-list-columns';
import { ColumnsMenu } from '../columns-menu';
import type { ColumnsMenuProps, ColumnsMenuSupport } from '../columns-menu';

// The menu never fetches: everything it offers comes from its props, so it renders with no providers.

const onChange = vi.fn<(next: TraceColumnPreferences) => void>();

const FULL_SUPPORT: ColumnsMenuSupport = {
  isLoading: false,
  withQuery: true,
  withTimeToFirstChunk: true,
  withTimeToFirstToken: true,
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
      support={FULL_SUPPORT}
      metadataKeys={['region', 'tenant']}
      metricsSupport={{ supported: true, isLoading: false }}
      {...props}
    />
  );
}

const renderMenu = (props: Partial<ColumnsMenuProps> = {}) => render(<Host {...props} />);
const withSupport = (support: Partial<ColumnsMenuSupport>) => ({ ...FULL_SUPPORT, ...support });

const columnsButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Columns' });
const openMenu = () => fireEvent.click(columnsButton());

const openMetadataKeyList = async () => {
  openMenu();
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Metadata key' }));
};

const optionNames = () => screen.queryAllByRole('option').map(option => option.textContent);

describe('ColumnsMenu', () => {
  beforeEach(() => {
    onChange.mockReset();
  });

  describe('when the scope is threads', () => {
    it('offers the thread columns, including the message count and both streaming timings', async () => {
      renderMenu({ scope: 'threads', value: TRACE_COLUMN_CATALOGS.threads.defaults });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Messages' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Time to first chunk' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Time to first token' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Model' })).toBeNull();
    });

    it('offers neither usage nor metadata columns, even when the host passes keys', async () => {
      renderMenu({ scope: 'threads', value: TRACE_COLUMN_CATALOGS.threads.defaults });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Input tokens' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Add metadata column' })).toBeNull();
    });

    it('does not offer the streaming timings when the store does not record them', async () => {
      renderMenu({
        scope: 'threads',
        value: TRACE_COLUMN_CATALOGS.threads.defaults,
        support: withSupport({ withTimeToFirstChunk: false, withTimeToFirstToken: false }),
      });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Messages' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Time to first chunk' })).toBeNull();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Time to first token' })).toBeNull();
    });

    it('hands the host the thread defaults on reset', async () => {
      renderMenu({
        scope: 'threads',
        value: { visibleColumns: ['timeToFirstToken'], customColumns: [], metadataKeys: [] },
      });

      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));

      expect(onChange).toHaveBeenCalledWith(TRACE_COLUMN_CATALOGS.threads.defaults);
    });
  });

  describe('while the host is still loading support', () => {
    it('keeps the Columns button in place but disabled, and enables it once support arrives', () => {
      const { rerender } = render(
        <ColumnsMenu
          scope="spans"
          value={TRACE_COLUMN_CATALOGS.spans.defaults}
          onChange={onChange}
          support={withSupport({ isLoading: true, withQuery: false })}
        />,
      );

      expect(columnsButton().disabled).toBe(true);

      rerender(
        <ColumnsMenu
          scope="spans"
          value={TRACE_COLUMN_CATALOGS.spans.defaults}
          onChange={onChange}
          support={FULL_SUPPORT}
        />,
      );

      expect(columnsButton().disabled).toBe(false);
    });
  });

  describe('when the user toggles a column', () => {
    it('hands the host the whole next selection', async () => {
      renderMenu();

      openMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Duration' }));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_TRACE_COLUMN_PREFERENCES,
        visibleColumns: DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns.filter(column => column !== 'duration'),
      });
    });

    it('hands the host the defaults on reset', async () => {
      renderMenu({ value: { visibleColumns: ['input'], customColumns: ['threadId'], metadataKeys: ['tenant'] } });

      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));

      expect(onChange).toHaveBeenCalledWith(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });
  });

  describe('when the host passes metadata keys', () => {
    it('offers them as metadata columns', async () => {
      renderMenu();

      await openMetadataKeyList();

      expect(optionNames()).toEqual(['region', 'tenant']);
    });

    it('adds the picked key as a metadata column', async () => {
      renderMenu();

      await openMetadataKeyList();
      const option = await screen.findByRole('option', { name: 'tenant' });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_TRACE_COLUMN_PREFERENCES, metadataKeys: ['tenant'] });
    });
  });

  describe('when the host has no metadata keys', () => {
    it('still lets the user type a key', async () => {
      renderMenu({ metadataKeys: undefined });

      await openMetadataKeyList();
      await userEvent.keyboard('tenant');

      expect(await screen.findByRole('option', { name: 'Use “tenant”' })).toBeTruthy();
    });
  });

  describe('when the query API is unavailable', () => {
    it('does not offer metadata columns', async () => {
      renderMenu({ support: withSupport({ withQuery: false }) });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Add metadata column' })).toBeNull();
    });
  });

  describe('when the scope is spans', () => {
    it('offers the span columns, including model and provider', async () => {
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Model' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Provider' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Trace ID' })).toBeTruthy();
    });

    it('offers neither usage nor metadata columns, even when the host passes keys', async () => {
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Input tokens' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Add metadata column' })).toBeNull();
    });

    it('hands the host the span defaults on reset', async () => {
      renderMenu({
        scope: 'spans',
        value: { visibleColumns: ['model'], customColumns: ['traceId'], metadataKeys: [] },
      });

      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));

      expect(onChange).toHaveBeenCalledWith(TRACE_COLUMN_CATALOGS.spans.defaults);
    });
  });

  describe.each([
    { column: 'Time to first chunk', flag: 'withTimeToFirstChunk', other: 'Time to first token' },
    { column: 'Time to first token', flag: 'withTimeToFirstToken', other: 'Time to first chunk' },
  ] as const)('$column column', ({ column, flag, other }) => {
    it('offers it when the store records it, and hands the host the selection with it', async () => {
      renderMenu();

      openMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: column }));

      const id = flag === 'withTimeToFirstChunk' ? 'timeToFirstChunk' : 'timeToFirstToken';
      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_TRACE_COLUMN_PREFERENCES,
        visibleColumns: [...DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns, id],
      });
    });

    it('does not offer it when the store does not record it, but keeps the other timing', async () => {
      renderMenu({ support: withSupport({ [flag]: false }) });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: other })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: column })).toBeNull();
    });

    it('does not offer it without the query API, whose rows are the only ones that carry it', async () => {
      renderMenu({ support: withSupport({ withQuery: false }) });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: column })).toBeNull();
    });

    it('is offered for spans too, whose rows carry it', async () => {
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: column })).toBeTruthy();
    });

    it('is not offered for spans when the store does not record it', async () => {
      renderMenu({
        scope: 'spans',
        value: TRACE_COLUMN_CATALOGS.spans.defaults,
        support: withSupport({ [flag]: false }),
      });

      openMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: other })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: column })).toBeNull();
    });
  });

  describe('streaming timings for spans', () => {
    it('lists time to first token right after time to first chunk', async () => {
      renderMenu({ scope: 'spans', value: TRACE_COLUMN_CATALOGS.spans.defaults });

      openMenu();
      await screen.findByRole('menuitemcheckbox', { name: 'Time to first token' });

      const names = screen.getAllByRole('menuitemcheckbox').map(item => item.textContent);
      expect(names.indexOf('Time to first token')).toBe(names.indexOf('Time to first chunk') + 1);
    });
  });

  describe('usage columns', () => {
    it('disables them and says why when the store has no metrics', async () => {
      renderMenu({ metricsSupport: { supported: false, isLoading: false } });

      openMenu();

      const inputTokens = await screen.findByRole('menuitemcheckbox', { name: 'Input tokens' });
      expect(inputTokens.getAttribute('data-disabled')).not.toBeNull();
      expect(screen.getByRole('note').textContent).toBe(
        'This observability store does not support token and cost metrics.',
      );
    });

    it('says support is being checked while metrics support loads', async () => {
      renderMenu({ metricsSupport: { supported: false, isLoading: true } });

      openMenu();

      expect(await screen.findByText('Checking whether this storage supports usage data.')).toBeTruthy();
    });

    it('treats usage as unsupported when the host does not say', async () => {
      renderMenu({ metricsSupport: undefined });

      openMenu();

      expect(await screen.findByText('This observability store does not support token and cost metrics.')).toBeTruthy();
    });
  });
});
