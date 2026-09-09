// @vitest-environment jsdom
import { cleanup, act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TabContent } from './tabs-content';
import { TabList } from './tabs-list';
import { Tabs } from './tabs-root';
import { Tab } from './tabs-tab';

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

describe('Tab', () => {
  it('keeps attention after selection until the caller clears it', () => {
    const content = (attention: boolean) => (
      <Tabs defaultTab="first">
        <TabList>
          <Tab value="first">First</Tab>
          <Tab value="second" attention={attention}>
            Second
          </Tab>
        </TabList>
      </Tabs>
    );
    const { rerender } = render(content(true));
    expect(screen.getByText('Needs attention').closest('[role=tab]')?.textContent).toBe('Second Needs attention');
    const tab = screen.getByRole('tab', { name: /^Second\s*Needs attention$/ });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Needs attention')).toBeTruthy();
    expect(tab.querySelector('[data-slot="tab-attention"]')?.getAttribute('aria-hidden')).toBe('true');
    rerender(content(false));
    expect(screen.queryByText('Needs attention')).toBeNull();
    expect(tab.querySelector('[data-slot="tab-attention"]')).toBeNull();
  });
  it.each([
    ['stroke', 200],
    ['inset', 234],
  ] as const)('keeps exactly fitting %s tabs out of the overflow menu', (frame, width) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    render(
      <Tabs defaultTab="first" appearance="contained" frame={frame}>
        <TabList>
          <Tab value="first">First</Tab>
          <Tab value="second">Second</Tab>
        </TabList>
      </Tabs>,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /more tabs/ })).toBeNull();
  });

  it('keeps an inserted tab ahead of later tabs in overflow order', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    const content = (feedback: boolean) => (
      <Tabs defaultTab="first" appearance="contained" frame="inset">
        <TabList>
          <Tab value="first">First</Tab>
          {feedback && <Tab value="feedback">Feedback</Tab>}
          <Tab value="scores">Scores</Tab>
        </TabList>
      </Tabs>
    );
    const { rerender } = render(content(false));
    rerender(content(true));
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['First', 'Feedback']);
    fireEvent.click(screen.getByRole('button', { name: '1 more tabs' }));
    expect(screen.getByRole('menuitem', { name: 'Scores' })).toBeTruthy();
  });

  it('restores all tabs when contained appearance changes to default', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    const content = (appearance: 'default' | 'contained') => (
      <Tabs defaultTab="first" appearance={appearance} frame="inset">
        <TabList>
          <Tab value="first">First</Tab>
          <Tab value="second">Second</Tab>
        </TabList>
      </Tabs>
    );
    const { rerender } = render(content('contained'));
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    rerender(content('default'));
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /more tabs/ })).toBeNull();
  });

  it('moves overflowed tabs into the menu and promotes the selected item', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    render(
      <Tabs defaultTab="first" appearance="contained" frame="inset">
        <TabList>
          <Tab value="first">First</Tab>
          <Tab value="second">Second</Tab>
          <Tab value="third">Third</Tab>
        </TabList>
        <TabContent value="first">First panel</TabContent>
        <TabContent value="second">Second panel</TabContent>
        <TabContent value="third">Third panel</TabContent>
      </Tabs>,
    );
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['First', 'Second']);
    fireEvent.click(screen.getByRole('button', { name: '1 more tabs' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Third' }));
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['First', 'Third']);
    expect(screen.getByRole('tab', { name: 'Third' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Third panel')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Second' })).toBeNull();
  });

  it('restores overflowed tabs when the container grows', () => {
    const callbacks = new Set<() => void>();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: () => void) {
          callbacks.add(callback);
        }
        observe() {}
        disconnect() {
          callbacks.delete(this.callback);
        }
        unobserve() {}
      },
    );
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(180);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    render(
      <Tabs defaultTab="first" appearance="contained">
        <TabList>
          <Tab value="first">First</Tab>
          <Tab value="second">Second</Tab>
        </TabList>
      </Tabs>,
    );
    expect(screen.queryByRole('tab', { name: 'Second' })).toBeNull();
    width.mockReturnValue(1024);
    act(() => callbacks.forEach(callback => callback()));
    expect(screen.getByRole('tab', { name: 'Second' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '1 more tabs' })).toBeNull();
  });

  it('leaves controlled selection with the caller when an overflow item is chosen', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(180);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 100, 36));
    const onValueChange = vi.fn();
    const content = (value: string) => (
      <Tabs defaultTab="first" value={value} onValueChange={onValueChange} appearance="contained">
        <TabList>
          <Tab value="first">First</Tab>
          <Tab value="second">Second</Tab>
        </TabList>
      </Tabs>
    );
    const { rerender } = render(content('first'));
    fireEvent.click(screen.getByRole('button', { name: '1 more tabs' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Second' }));
    expect(onValueChange).toHaveBeenCalledWith('second');
    expect(screen.getByRole('tab', { name: 'First' }).getAttribute('aria-selected')).toBe('true');
    rerender(content('second'));
    expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
  });

  describe('when tabs use the contained appearance', () => {
    it('keeps the tab interface composable and switches its panel', () => {
      render(
        <Tabs defaultTab="overview" appearance="contained">
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="activity">Activity</Tab>
          </TabList>
          <TabContent value="overview">Overview content</TabContent>
          <TabContent value="activity">Activity content</TabContent>
        </Tabs>,
      );

      const tabs = document.querySelector('[data-slot="tabs"]');
      expect(tabs?.getAttribute('data-appearance')).toBe('contained');
      expect(document.querySelector('[data-slot="tabs-list"]')).not.toBeNull();
      expect(screen.getByText('Overview content')).toBeTruthy();

      fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));

      expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Activity content')).toBeTruthy();
    });
  });

  describe('when a tab is disabled', () => {
    it('marks the trigger as disabled and keeps it from becoming active', () => {
      render(
        <Tabs defaultTab="enabled">
          <TabList>
            <Tab value="enabled">Enabled</Tab>
            <Tab value="disabled" disabled disabledTooltip="Disabled tab">
              Disabled
            </Tab>
          </TabList>
          <TabContent value="enabled">Enabled content</TabContent>
          <TabContent value="disabled">Disabled content</TabContent>
        </Tabs>,
      );

      const enabledTab = screen.getByRole('tab', { name: 'Enabled' });
      const disabledTab = screen.getByRole('tab', { name: 'Disabled' });

      expect(disabledTab.getAttribute('aria-disabled')).toBe('true');
      expect(disabledTab.hasAttribute('data-disabled')).toBe(true);
      expect(disabledTab.className).toContain('aria-disabled:cursor-not-allowed');
      expect(disabledTab.className).toContain('data-[disabled]:cursor-not-allowed');

      fireEvent.click(disabledTab);

      expect(enabledTab.getAttribute('aria-selected')).toBe('true');
      expect(disabledTab.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('when a tab can be closed', () => {
    it('closes without also selecting the tab', () => {
      const onClose = vi.fn();
      const onClick = vi.fn();

      render(
        <Tabs defaultTab="first">
          <TabList>
            <Tab value="first">First</Tab>
            <Tab value="second" onClose={onClose} onClick={onClick}>
              Second
            </Tab>
          </TabList>
          <TabContent value="first">First content</TabContent>
          <TabContent value="second">Second content</TabContent>
        </Tabs>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Close tab' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      // The click must not bubble into the tab underneath it.
      expect(onClick).not.toHaveBeenCalled();
      expect(screen.getByRole('tab', { name: /First/ }).getAttribute('aria-selected')).toBe('true');
    });

    it('offers no close affordance without a close handler', () => {
      render(
        <Tabs defaultTab="first">
          <TabList>
            <Tab value="first">First</Tab>
          </TabList>
          <TabContent value="first">First content</TabContent>
        </Tabs>,
      );

      expect(screen.queryByRole('button', { name: 'Close tab' })).toBeNull();
    });
  });

  describe('when a tab is selected', () => {
    it('calls the caller handler and switches the panel', () => {
      const onClick = vi.fn();

      render(
        <Tabs defaultTab="first">
          <TabList>
            <Tab value="first">First</Tab>
            <Tab value="second" onClick={onClick}>
              Second
            </Tab>
          </TabList>
          <TabContent value="first">First content</TabContent>
          <TabContent value="second">Second content</TabContent>
        </Tabs>,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Second content')).toBeTruthy();
    });
  });

  describe('when a disabled tab explains itself', () => {
    it('wraps only the tab that has an explanation', () => {
      render(
        <Tabs defaultTab="enabled">
          <TabList>
            <Tab value="enabled">Enabled</Tab>
            <Tab value="explained" disabled disabledTooltip="Finish the run first">
              Explained
            </Tab>
            <Tab value="silent" disabled>
              Silent
            </Tab>
            <Tab value="enabled-with-text" disabledTooltip="Never shown">
              Enabled with text
            </Tab>
          </TabList>
          <TabContent value="enabled">Enabled content</TabContent>
        </Tabs>,
      );

      const isTooltipTrigger = (name: string) =>
        screen.getByRole('tab', { name }).hasAttribute('data-base-ui-tooltip-trigger');

      // Only a tab that is both disabled and has something to say gets one.
      expect(isTooltipTrigger('Explained')).toBe(true);
      expect(isTooltipTrigger('Silent')).toBe(false);
      expect(isTooltipTrigger('Enabled with text')).toBe(false);
      expect(isTooltipTrigger('Enabled')).toBe(false);
    });
  });

  it('keeps a caller class alongside its own', () => {
    render(
      <Tabs defaultTab="first">
        <TabList>
          <Tab value="first" className="my-own-class">
            First
          </Tab>
        </TabList>
        <TabContent value="first">First content</TabContent>
      </Tabs>,
    );

    const tab = screen.getByRole('tab', { name: 'First' });
    expect(tab.className).toContain('my-own-class');
    expect(tab.className).toContain('text-neutral3');
  });
});
