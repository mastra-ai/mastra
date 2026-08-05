// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TabContent } from './tabs-content';
import { TabList } from './tabs-list';
import { Tabs } from './tabs-root';
import { Tab } from './tabs-tab';

afterEach(() => {
  cleanup();
});

describe('Tab', () => {
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
});
