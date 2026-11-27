// @vitest-environment jsdom
import '@/test/english-locale';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../../types';
import { LogView, filterLogsByFields, logViewSearchText } from './index';
import type { FilterBarItem } from '@/ds/components/FilterBar';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

const logs: LogRecord[] = [
  {
    timestamp: '2026-11-24T09:35:58.956Z',
    level: 'error',
    message: 'Command failed',
    data: { exit_code: '1', operation_id: 'op_a771' },
  },
  {
    timestamp: '2026-11-24T09:31:07.956Z',
    level: 'info',
    message: 'Process.Start stream ended',
    data: { exit_code: '0', operation_id: 'op_8f21' },
  },
];

function Filters(props: { search?: boolean; fieldChips?: boolean; onValueChange?: (items: FilterBarItem[]) => void }) {
  return (
    <TooltipProvider>
      <LogView>
        <LogView.Header>
          <LogView.Filters
            logs={logs}
            value={[]}
            onValueChange={props.onValueChange ?? vi.fn()}
            search={props.search}
            fieldChips={props.fieldChips}
          />
        </LogView.Header>
      </LogView>
    </TooltipProvider>
  );
}

const input = () => screen.getByRole('combobox', { name: 'Add filter' });

const typeIntoFilters = (text: string) => {
  input().focus();
  fireEvent.change(input(), { target: { value: text } });
};

describe('LogView filters', () => {
  it('offers search and every log field by default', async () => {
    render(<Filters />);
    expect(input().getAttribute('placeholder')).toBe('Search or filter logs');

    typeIntoFilters('exit');

    expect(await screen.findByRole('option', { name: /contains "exit"/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'exit_code' })).toBeTruthy();
  });

  it('offers only search when field chips are turned off', async () => {
    render(<Filters fieldChips={false} />);
    expect(input().getAttribute('placeholder')).toBe('Search logs');

    typeIntoFilters('exit');

    expect(await screen.findByRole('option', { name: /contains "exit"/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'exit_code' })).toBeNull();
  });

  it('offers only field chips when search is turned off', async () => {
    render(<Filters search={false} />);
    expect(input().getAttribute('placeholder')).toBe('Filter logs');

    typeIntoFilters('exit');

    expect(await screen.findByRole('option', { name: 'exit_code' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /contains "exit"/ })).toBeNull();
  });
});

describe('LogView filter helpers', () => {
  const chip = (fieldId: string, value: string): FilterBarItem => ({ id: fieldId, fieldId, operatorId: 'is', value });

  it('keeps only the logs whose fields match every chip', () => {
    expect(filterLogsByFields(logs, [chip('field:exit_code', '1')])).toEqual([logs[0]]);
    expect(filterLogsByFields(logs, [chip('field:exit_code', '1'), chip('field:operation_id', 'op_8f21')])).toEqual([]);
    expect(filterLogsByFields(logs, [])).toBe(logs);
  });

  it('joins search chips into the text sent to the server and ignores field chips', () => {
    expect(logViewSearchText([chip('search', ' boom '), chip('field:exit_code', '1'), chip('search', 'node')])).toBe(
      'boom node',
    );
  });
});

describe('LogView empty state', () => {
  it('offers to clear filters only when the caller can clear them', () => {
    const onClearFilters = vi.fn();
    const { rerender } = render(
      <LogView>
        <LogView.Empty onClearFilters={onClearFilters} />
      </LogView>,
    );

    expect(screen.getByText('No logs match these filters')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();

    rerender(
      <LogView>
        <LogView.Empty />
      </LogView>,
    );
    expect(screen.getByText('No logs in this period')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });
});

describe('LogView header parts', () => {
  it('counts lines and copies all of them', () => {
    render(
      <TooltipProvider>
        <LogView>
          <LogView.Header>
            <LogView.Actions>
              <LogView.Count count={1204} />
              <LogView.Copy content={'line one\nline two'} />
            </LogView.Actions>
          </LogView.Header>
        </LogView>
      </TooltipProvider>,
    );

    expect(screen.getByText('1,204 lines')).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy/i }).getAttribute('type')).toBe('button');
  });
});
