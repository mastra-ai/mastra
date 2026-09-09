// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    const tab = screen.getByRole('tab', { name: 'Second Needs attention' });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Needs attention')).toBeTruthy();
    const pulse = tab.querySelector('.animate-pulse');
    expect(pulse?.className).toContain('[animation-iteration-count:3]');
    expect(pulse?.className).toContain('motion-reduce:animate-none');
    rerender(content(false));
    expect(screen.queryByText('Needs attention')).toBeNull();
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
