// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentPageTabs } from '../agent-page-tabs';

afterEach(cleanup);

describe('AgentPageTabs', () => {
  it('shows host tabs after the built-in ones and marks the active one', () => {
    render(
      <AgentPageTabs
        activeTab="schedules"
        chatHref="/chat"
        showUnavailableFeatures={false}
        extraTabs={[{ id: 'schedules', href: '/schedules', label: 'Schedules', icon: <span /> }]}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(['Chat', 'Schedules']);
    const schedules = screen.getByRole('link', { name: 'Schedules' });
    expect(schedules.getAttribute('href')).toBe('/schedules');
    expect(schedules.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('aria-current')).toBeNull();
  });
});
