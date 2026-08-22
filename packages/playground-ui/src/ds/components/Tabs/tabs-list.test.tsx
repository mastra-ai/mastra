// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { TabContent } from './tabs-content';
import { TabList } from './tabs-list';
import { Tabs } from './tabs-root';
import { Tab } from './tabs-tab';

afterEach(() => {
  cleanup();
});

const getScroller = () => {
  const scroller = screen.getByRole('tablist').parentElement;
  assert(scroller instanceof HTMLElement, 'Expected the tab list to sit in a scroller');
  return scroller;
};

/**
 * jsdom reports every box as 0×0, so overflow has to be faked: pin the metrics
 * the hook reads, then fire the event that makes it re-measure.
 */
const setMetrics = (
  element: HTMLElement,
  metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number },
) => {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: metrics.scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: metrics.clientWidth });
  element.scrollLeft = metrics.scrollLeft;
};

const renderTabs = () =>
  render(
    <Tabs defaultTab="one">
      <TabList variant="pill">
        <Tab value="one">One</Tab>
        <Tab value="two">Two</Tab>
      </TabList>
      <TabContent value="one">One content</TabContent>
      <TabContent value="two">Two content</TabContent>
    </Tabs>,
  );

describe('TabList', () => {
  describe('when the tabs fit their container', () => {
    it('marks neither edge as clipped, so a non-overflowing tab bar renders unmasked', () => {
      renderTabs();
      const scroller = getScroller();

      expect(scroller.hasAttribute('data-overflow-x-start')).toBe(false);
      expect(scroller.hasAttribute('data-overflow-x-end')).toBe(false);
    });

    it('leaves sub-pixel scroll range alone rather than reporting it as clipped', async () => {
      renderTabs();
      const scroller = getScroller();

      setMetrics(scroller, { scrollLeft: 0, scrollWidth: 200.6, clientWidth: 200 });
      scroller.dispatchEvent(new Event('scroll'));

      expect(scroller.hasAttribute('data-overflow-x-end')).toBe(false);
    });
  });

  describe('when the tabs overrun their container', () => {
    it('flags the trailing edge so the clipped tab is faded instead of cut off', async () => {
      renderTabs();
      const scroller = getScroller();

      setMetrics(scroller, { scrollLeft: 0, scrollWidth: 400, clientWidth: 200 });
      scroller.dispatchEvent(new Event('scroll'));

      await waitFor(() => expect(scroller.hasAttribute('data-overflow-x-end')).toBe(true));
      expect(scroller.hasAttribute('data-overflow-x-start')).toBe(false);
    });

    it('flags both edges once scrolled off either end', async () => {
      renderTabs();
      const scroller = getScroller();

      setMetrics(scroller, { scrollLeft: 100, scrollWidth: 400, clientWidth: 200 });
      scroller.dispatchEvent(new Event('scroll'));

      await waitFor(() => expect(scroller.hasAttribute('data-overflow-x-start')).toBe(true));
      expect(scroller.hasAttribute('data-overflow-x-end')).toBe(true);
    });

    it('drops the trailing flag at the end of the scroll range', async () => {
      renderTabs();
      const scroller = getScroller();

      setMetrics(scroller, { scrollLeft: 200, scrollWidth: 400, clientWidth: 200 });
      scroller.dispatchEvent(new Event('scroll'));

      await waitFor(() => expect(scroller.hasAttribute('data-overflow-x-start')).toBe(true));
      expect(scroller.hasAttribute('data-overflow-x-end')).toBe(false);
    });
  });
});
