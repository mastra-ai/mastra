// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataList } from './data-list';

const ROW_HEIGHT = 36;

function stubLayout(element: HTMLElement, top: number) {
  Object.defineProperty(element, 'offsetParent', { value: element.parentElement, configurable: true });
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
  Object.defineProperty(element, 'offsetLeft', { value: 0, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: ROW_HEIGHT, configurable: true });
}

async function flushFrames() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
  }
}

function grid() {
  return screen.getByTestId('list').querySelector('.grid') as HTMLElement;
}

function activeRows() {
  return Array.from(screen.getByTestId('list').querySelectorAll('[data-fluid-hover-active]'));
}

function hoverAt(y: number) {
  fireEvent.mouseMove(grid(), { clientX: 10, clientY: y });
}

/** Lays out every `.data-list-row` (and subheaders) top-to-bottom in DOM order. */
async function setup(children: ReactNode) {
  const view = render(
    <DataList data-testid="list" columns="1fr">
      {children}
    </DataList>,
  );
  const g = grid();
  Array.from(g.children)
    .filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.getAttribute('data-slot') !== 'fluid-hover-highlight',
    )
    .forEach((el, i) => stubLayout(el, i * ROW_HEIGHT));
  Object.defineProperty(g, 'getBoundingClientRect', {
    value: () => ({ top: 0, left: 0, width: 200, height: 4 * ROW_HEIGHT, right: 200, bottom: 4 * ROW_HEIGHT }),
  });
  await flushFrames();
  return view;
}

describe('DataList fluid hover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lights the hovered RowButton', async () => {
    await setup(
      <>
        <DataList.RowButton>a</DataList.RowButton>
        <DataList.RowButton>b</DataList.RowButton>
        <DataList.RowButton>c</DataList.RowButton>
      </>,
    );
    hoverAt(ROW_HEIGHT + 5);
    await flushFrames();
    expect(activeRows().map(r => r.textContent)).toEqual(['b']);
  });

  it('lights the RowWrapper, never the nested RowButton', async () => {
    await setup(
      <>
        <DataList.RowWrapper data-testid="wrapper">
          <DataList.RowButton>a</DataList.RowButton>
        </DataList.RowWrapper>
        <DataList.RowWrapper>
          <DataList.RowButton>b</DataList.RowButton>
        </DataList.RowWrapper>
      </>,
    );
    hoverAt(5);
    await flushFrames();
    const active = activeRows();
    expect(active).toHaveLength(1);
    expect(active[0]).toBe(screen.getByTestId('wrapper'));
  });

  it('never lights RowStatic or Subheader; hovering them lights the nearest interactive row', async () => {
    await setup(
      <>
        <DataList.RowButton>a</DataList.RowButton>
        <DataList.Subheader>group</DataList.Subheader>
        <DataList.RowStatic>static</DataList.RowStatic>
        <DataList.RowButton>b</DataList.RowButton>
      </>,
    );
    hoverAt(ROW_HEIGHT + 5); // subheader
    await flushFrames();
    expect(activeRows().map(r => r.textContent)).toEqual(['a']);

    hoverAt(ROW_HEIGHT * 2 + 30); // static row, closer to b
    await flushFrames();
    expect(activeRows().map(r => r.textContent)).toEqual(['b']);
  });

  it('does not route a click on a Subheader to the highlighted row', async () => {
    const onClick = vi.fn();
    await setup(
      <>
        <DataList.RowButton onClick={onClick}>a</DataList.RowButton>
        <DataList.Subheader>group</DataList.Subheader>
        <DataList.RowButton>b</DataList.RowButton>
      </>,
    );
    hoverAt(ROW_HEIGHT + 5);
    await flushFrames();
    expect(activeRows().map(r => r.textContent)).toEqual(['a']);

    fireEvent.click(screen.getByText('group'), { clientX: 10, clientY: ROW_HEIGHT + 5 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('skips a disabled RowButton', async () => {
    await setup(
      <>
        <DataList.RowButton>a</DataList.RowButton>
        <DataList.RowButton disabled>b</DataList.RowButton>
        <DataList.RowButton>c</DataList.RowButton>
      </>,
    );
    hoverAt(ROW_HEIGHT + 5);
    await flushFrames();
    expect(activeRows().map(r => r.textContent)).not.toEqual(['b']);
    expect(activeRows()).toHaveLength(1);
  });
});
