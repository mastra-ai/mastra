// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartCard } from './chart-card';

const views = [
  { value: 'model', label: 'By model' },
  { value: 'provider', label: 'By provider' },
];

describe('ChartCard', () => {
  afterEach(() => cleanup());

  describe('compact', () => {
    it('shows the title and the total on one line', () => {
      render(
        <ChartCard variant="compact" title="Tokens" total="992K">
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('heading', { name: 'Tokens' })).toBeTruthy();
      expect(screen.getByText('992K')).toBeTruthy();
    });

    it('swaps the total for a skeleton while loading', () => {
      render(
        <ChartCard variant="compact" title="Tokens" total="992K" isLoading>
          <div />
        </ChartCard>,
      );
      expect(screen.queryByText('992K')).toBeNull();
    });
  });

  describe('with a title menu', () => {
    it('switches views from the title', async () => {
      const onValueChange = vi.fn();
      render(
        <ChartCard
          variant="compact"
          title="Spend by model"
          titleMenu={{ value: 'model', onValueChange, options: views }}
        >
          <div />
        </ChartCard>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Spend by model' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'By provider' }));
      expect(onValueChange).toHaveBeenCalledWith('provider');
      // Picking a view closes the menu.
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });

    it("keeps the title as the top bar's first item, sized to its text, while the menu is open", async () => {
      render(
        <ChartCard
          variant="compact"
          title="Spend by model"
          total="$12"
          titleMenu={{ value: 'model', onValueChange: vi.fn(), options: views }}
        >
          <div />
        </ChartCard>,
      );
      const trigger = screen.getByRole('button', { name: 'Spend by model' });
      const topBar = trigger.parentElement?.parentElement;
      // The top bar stretches its first item; that's the wrapper, so the button keeps its width.
      expect(topBar?.firstElementChild).toBe(trigger.parentElement);
      fireEvent.click(trigger);
      await screen.findByRole('menuitemradio', { name: 'By provider' });
      expect(topBar?.firstElementChild?.contains(trigger)).toBe(true);
      expect(topBar?.lastElementChild?.textContent).toBe('$12');
    });

    it("leaves the card's actions clickable while the menu is open", async () => {
      const onPin = vi.fn();
      render(
        <ChartCard
          title="Spend by model"
          titleMenu={{ value: 'model', onValueChange: vi.fn(), options: views }}
          persistentActions={
            <button type="button" onClick={onPin}>
              Pin
            </button>
          }
        >
          <div />
        </ChartCard>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Spend by model' }));
      await screen.findByRole('menuitemradio', { name: 'By provider' });
      // A modal menu draws a full-screen backdrop that swallows clicks meant for the card's actions.
      expect(document.querySelector('[role="presentation"][data-base-ui-inert]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
      expect(onPin).toHaveBeenCalledOnce();
    });
  });

  it('adds no legend row to a card that passes no toolbar', () => {
    const { container } = render(
      <ChartCard title="Requests">
        <div />
      </ChartCard>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"].min-h-6')).toHaveLength(0);
  });

  it('keeps an empty legend row when the toolbar is false (nothing to show yet)', () => {
    const { container } = render(
      <ChartCard title="Resources and threads" toolbar={false}>
        <div data-testid="body" />
      </ChartCard>,
    );
    const body = screen.getByTestId('body').parentElement;
    expect(body?.previousElementSibling?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[aria-hidden="true"].min-h-6')).toHaveLength(1);
  });

  describe('hero', () => {
    it('shows the title as a label over the total, with the change against the previous period', () => {
      render(
        <ChartCard variant="hero" title="Spend sum" total="$138.92" change="+71.4%" actions={<button>Bucket</button>}>
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('heading', { name: 'Spend sum' })).toBeTruthy();
      expect(screen.getByText('$138.92')).toBeTruthy();
      expect(screen.getByText('+71.4% vs previous')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Bucket' })).toBeTruthy();
    });

    it('swaps the total for a skeleton while loading, without the change', () => {
      render(
        <ChartCard variant="hero" title="Spend sum" total="$138.92" change="+71.4%" isLoading>
          <div />
        </ChartCard>,
      );
      expect(screen.queryByText('$138.92')).toBeNull();
      expect(screen.queryByText('+71.4% vs previous')).toBeNull();
    });
  });

  it('makes the title a link to a fuller view, with the given link component', () => {
    const Link = ({ href, ...props }: { href: string }) => <a href={`/app${href}`} data-router-link {...props} />;
    const { rerender } = render(
      <ChartCard variant="compact" title="Spend by model" href="/query?metric=spend" total="$12">
        <div />
      </ChartCard>,
    );
    const link = screen.getByRole('link', { name: 'Spend by model' });
    expect(link.getAttribute('href')).toBe('/query?metric=spend');
    expect(screen.getByRole('heading', { name: 'Spend by model' }).contains(link)).toBe(true);

    rerender(
      <ChartCard title="Spend by model" href="/query" LinkComponent={Link}>
        <div />
      </ChartCard>,
    );
    expect(screen.getByRole('link', { name: 'Spend by model' }).getAttribute('href')).toBe('/app/query');
  });
  describe('with an editable title', () => {
    const titleInput = () => screen.getByRole('textbox', { name: 'Widget title' });

    function renderEditable(props: Partial<Parameters<typeof ChartCard>[0]> = {}) {
      const onTitleChange = vi.fn();
      render(
        <ChartCard title="Spend by model" onTitleChange={onTitleChange} {...props}>
          <div />
        </ChartCard>,
      );
      return onTitleChange;
    }

    it('shows the title in an input inside the heading', () => {
      renderEditable();
      expect(titleInput()).toHaveProperty('value', 'Spend by model');
      expect(screen.getByRole('heading').contains(titleInput())).toBe(true);
    });

    it('is plain text without onTitleChange', () => {
      render(
        <ChartCard title="Spend by model">
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('heading', { name: 'Spend by model' })).toBeTruthy();
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('commits the trimmed title on Enter', () => {
      const onTitleChange = renderEditable();
      titleInput().focus();
      fireEvent.change(titleInput(), { target: { value: '  Spend by provider ' } });
      fireEvent.keyDown(titleInput(), { key: 'Enter' });
      expect(onTitleChange).toHaveBeenCalledTimes(1);
      expect(onTitleChange).toHaveBeenCalledWith('Spend by provider');
      expect(document.activeElement).not.toBe(titleInput());
    });

    it('commits the title on blur', () => {
      const onTitleChange = renderEditable();
      titleInput().focus();
      fireEvent.change(titleInput(), { target: { value: 'Spend by provider' } });
      fireEvent.blur(titleInput());
      expect(onTitleChange).toHaveBeenCalledWith('Spend by provider');
    });

    it('reverts on Escape without committing', () => {
      const onTitleChange = renderEditable();
      titleInput().focus();
      fireEvent.change(titleInput(), { target: { value: 'Spend by provider' } });
      fireEvent.keyDown(titleInput(), { key: 'Escape' });
      expect(titleInput()).toHaveProperty('value', 'Spend by model');
      expect(document.activeElement).not.toBe(titleInput());
      expect(onTitleChange).not.toHaveBeenCalled();
    });

    it("doesn't commit a title that didn't change", () => {
      const onTitleChange = renderEditable();
      titleInput().focus();
      fireEvent.change(titleInput(), { target: { value: 'Spend by model  ' } });
      fireEvent.keyDown(titleInput(), { key: 'Enter' });
      expect(onTitleChange).not.toHaveBeenCalled();
      expect(titleInput()).toHaveProperty('value', 'Spend by model');
    });

    it('shows the title the caller passes back', () => {
      const onTitleChange = vi.fn();
      const { rerender } = render(
        <ChartCard title="Spend by model" onTitleChange={onTitleChange}>
          <div />
        </ChartCard>,
      );
      rerender(
        <ChartCard title="Spend by provider" onTitleChange={onTitleChange}>
          <div />
        </ChartCard>,
      );
      expect(titleInput()).toHaveProperty('value', 'Spend by provider');
    });

    it('is not editable with a title menu or a link', () => {
      renderEditable({ titleMenu: { value: 'model', onValueChange: () => {}, options: views } });
      expect(screen.queryByRole('textbox')).toBeNull();
      cleanup();
      renderEditable({ href: '/query' });
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.getByRole('link', { name: 'Spend by model' })).toBeTruthy();
    });

    it('sits after the drag handle, which still drags the card', () => {
      renderEditable({ dragHandle: { 'aria-label': 'Move card', draggable: true } });
      const handle = screen.getByRole('button', { name: 'Move card' });
      expect(handle.getAttribute('draggable')).toBe('true');
      expect(handle.compareDocumentPosition(titleInput()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(titleInput().closest('[draggable="true"]')).toBeNull();
    });
  });
});
