// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataList } from '../data-list';
import { TabbedContainer } from './tabbed-container';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1024);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

const renderTables = () =>
  render(
    <TabbedContainer defaultTab="runs">
      <TabbedContainer.DataList
        value="runs"
        label="Runs"
        columns="auto 1fr"
        search={{ label: 'Search runs', placeholder: 'Search runs', onSearch: vi.fn() }}
        filter={{
          'aria-label': 'Filter by status',
          multiple: true,
          options: [{ value: 'failed', label: 'Failed' }],
          placeholder: 'Status',
          value: ['failed'],
          onValueChange: vi.fn(),
        }}
      >
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Input</DataList.TopCell>
        </DataList.Top>
        <DataList.RowStatic>
          <DataList.Cell>run_1</DataList.Cell>
          <DataList.Cell>What is the weather?</DataList.Cell>
        </DataList.RowStatic>
      </TabbedContainer.DataList>
      <TabbedContainer.DataList
        value="scores"
        label="Scores"
        columns="auto 1fr"
        search={{ label: 'Search scores', placeholder: 'Search scores', onSearch: vi.fn() }}
      >
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Scorer</DataList.TopCell>
        </DataList.Top>
        <DataList.RowStatic>
          <DataList.Cell>score_1</DataList.Cell>
          <DataList.Cell>answer-relevancy</DataList.Cell>
        </DataList.RowStatic>
      </TabbedContainer.DataList>
    </TabbedContainer>,
  );

describe('TabbedContainer', () => {
  it('builds one tab per child and shows the default table', () => {
    renderTables();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Runs', 'Scores']);
    const filterTrigger = screen.getByRole('combobox', { name: 'Filter by status' });
    const filterControl = filterTrigger.closest('[data-slot="tabbed-container-filter"]');
    expect(filterControl?.hasAttribute('data-active')).toBe(true);
    expect(document.querySelector('[data-slot="tabbed-container-filter-count"]')?.textContent).toBe('1');
    expect(screen.getByText('What is the weather?')).toBeTruthy();
    expect(screen.queryByText('answer-relevancy')).toBeNull();
  });

  it('switches tables and keeps each DataList search control mounted in the shared rail', () => {
    renderTables();
    const runsToolbar = screen.getByLabelText('Search runs').closest('[data-slot="tabbed-container-controls"]');
    const scoresToolbar = screen.getByLabelText('Search scores').closest('[data-slot="tabbed-container-controls"]');
    const runsSearch = screen.getByLabelText('Search runs');
    fireEvent.change(runsSearch, { target: { value: 'weather' } });
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });
    expect(document.activeElement).toBe(runsSearch);
    expect(runsToolbar?.hasAttribute('data-active')).toBe(true);
    expect(runsToolbar?.hasAttribute('inert')).toBe(false);
    expect(scoresToolbar?.hasAttribute('data-active')).toBe(false);
    expect(scoresToolbar?.getAttribute('aria-hidden')).toBe('true');
    expect(scoresToolbar?.hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Scores' }));
    expect(screen.getByText('answer-relevancy')).toBeTruthy();
    expect(runsToolbar?.hasAttribute('data-active')).toBe(false);
    expect(runsToolbar?.getAttribute('aria-hidden')).toBe('true');
    expect(runsToolbar?.hasAttribute('inert')).toBe(true);
    expect(scoresToolbar?.hasAttribute('data-active')).toBe(true);
    expect(scoresToolbar?.hasAttribute('inert')).toBe(false);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });
    expect(document.activeElement).toBe(screen.getByLabelText('Search scores'));
    fireEvent.click(screen.getByRole('tab', { name: 'Runs' }));
    expect(screen.getByLabelText<HTMLInputElement>('Search runs').value).toBe('weather');
  });

  it('keeps an empty multi-filter inactive', () => {
    render(
      <TabbedContainer defaultTab="runs">
        <TabbedContainer.DataList
          value="runs"
          label="Runs"
          columns="auto"
          filter={{
            'aria-label': 'Filter by status',
            multiple: true,
            options: [{ value: 'failed', label: 'Failed' }],
            value: [],
          }}
        >
          <DataList.RowStatic>
            <DataList.Cell>run_1</DataList.Cell>
          </DataList.RowStatic>
        </TabbedContainer.DataList>
      </TabbedContainer>,
    );

    const filterControl = screen
      .getByRole('combobox', { name: 'Filter by status' })
      .closest('[data-slot="tabbed-container-filter"]');
    expect(filterControl?.hasAttribute('data-active')).toBe(false);
    expect(document.querySelector('[data-slot="tabbed-container-filter-count"]')).toBeNull();
  });

  it('switches between arbitrary content and a searchable DataList', () => {
    render(
      <TabbedContainer defaultTab="overview">
        <TabbedContainer.Panel value="overview" label="Overview">
          <div>Overview content</div>
        </TabbedContainer.Panel>
        <TabbedContainer.DataList
          value="runs"
          label="Runs"
          columns="auto"
          search={{ label: 'Search runs', placeholder: 'Search runs', onSearch: vi.fn() }}
        >
          <DataList.RowStatic>
            <DataList.Cell>run_1</DataList.Cell>
          </DataList.RowStatic>
        </TabbedContainer.DataList>
      </TabbedContainer>,
    );

    const controls = screen.getByLabelText('Search runs').closest('[data-slot="tabbed-container-controls"]');
    expect(screen.getByText('Overview content')).toBeTruthy();
    expect(controls?.hasAttribute('data-active')).toBe(false);

    fireEvent.click(screen.getByRole('tab', { name: 'Runs' }));
    expect(screen.getByText('run_1')).toBeTruthy();
    expect(controls?.hasAttribute('data-active')).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(controls?.hasAttribute('data-active')).toBe(false);
    expect(screen.getByText('run_1')).toBeTruthy();
  });

  it('uses the inset frame by default and honors an explicit frame', () => {
    const { rerender } = render(
      <TabbedContainer defaultTab="runs" className="custom-root">
        <TabbedContainer.DataList value="runs" label="Runs" columns="auto">
          <DataList.RowStatic>
            <DataList.Cell>run_1</DataList.Cell>
          </DataList.RowStatic>
        </TabbedContainer.DataList>
      </TabbedContainer>,
    );
    const root = () => screen.getByRole('tab', { name: 'Runs' }).closest('[data-slot="tabs"]');
    expect(root()?.getAttribute('data-frame')).toBe('inset');
    expect(root()?.getAttribute('data-appearance')).toBe('contained');
    expect(root()?.classList.contains('tabbed-container')).toBe(true);
    expect(root()?.classList.contains('custom-root')).toBe(true);
    rerender(
      <TabbedContainer defaultTab="runs" frame="stroke" className="custom-root">
        <TabbedContainer.DataList value="runs" label="Runs" columns="auto">
          <DataList.RowStatic>
            <DataList.Cell>run_1</DataList.Cell>
          </DataList.RowStatic>
        </TabbedContainer.DataList>
      </TabbedContainer>,
    );
    expect(root()?.getAttribute('data-frame')).toBe('stroke');
  });

  it('mixes arbitrary panels with DataLists and ignores unrelated children', () => {
    render(
      <TabbedContainer defaultTab="overview">
        <div>stray node</div>
        <TabbedContainer.Panel value="overview" label="Overview">
          <div>Overview content</div>
        </TabbedContainer.Panel>
        <TabbedContainer.DataList value="scores" label="Scores" columns="auto" disabled attention>
          <DataList.RowStatic>
            <DataList.Cell>score_1</DataList.Cell>
          </DataList.RowStatic>
        </TabbedContainer.DataList>
      </TabbedContainer>,
    );

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Overview', 'Scores Needs attention']);
    expect(screen.getByText('Overview content')).toBeTruthy();
    expect(screen.queryByText('stray node')).toBeNull();
    expect(document.querySelectorAll('[data-slot="tabbed-container-controls"]')).toHaveLength(0);
    const scores = screen.getByRole('tab', { name: /Scores/ });
    expect(scores.getAttribute('aria-disabled')).toBe('true');
  });

  it('forwards close behavior when a DataList moves into overflow', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(180);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    const onClose = vi.fn();
    render(
      <TabbedContainer defaultTab="overview">
        <TabbedContainer.Panel value="overview" label="Overview">
          <div>Overview content</div>
        </TabbedContainer.Panel>
        <TabbedContainer.DataList value="runs" label="Runs" columns="auto" onClose={onClose}>
          <DataList.RowStatic>
            <DataList.Cell>run_1</DataList.Cell>
          </DataList.RowStatic>
        </TabbedContainer.DataList>
      </TabbedContainer>,
    );

    expect(screen.queryByRole('tab', { name: 'Runs' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 more tabs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close tab' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders DataLists flush inside the frame', () => {
    renderTables();
    const panel = screen.getByText('What is the weather?').closest('[data-slot="tabs-content"]');
    expect(panel?.getAttribute('data-flush')).toBe('true');
  });
});
