// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { agentIndexLoader, legacyAgentSettingsLoader } from '@/lib/app-routing';
import { renderWithProviders } from '@/test/render';

const AGENT_ID = 'agent-1';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

const buildRouter = (initialEntry: string) =>
  createMemoryRouter(
    [
      {
        element: (
          <>
            <LocationProbe />
            <Outlet />
          </>
        ),
        children: [
          {
            path: '/agents/:agentId',
            children: [
              { index: true, loader: agentIndexLoader },
              { path: 'overview', loader: legacyAgentSettingsLoader },
              { path: 'settings', loader: legacyAgentSettingsLoader },
            ],
          },
          { path: '/agents/:agentId/threads/:threadId', element: <div data-testid="thread-route" /> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (initialEntry: string) => renderWithProviders(<RouterProvider router={buildRouter(initialEntry)} />);

const locationIs = (expected: string) =>
  waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(expected));

describe('agent landing redirects', () => {
  it('redirects bare /agents/:agentId to the new-thread chat', async () => {
    renderAt(`/agents/${AGENT_ID}`);
    await locationIs(`/agents/${AGENT_ID}/threads/new`);
    expect(screen.getByTestId('thread-route')).not.toBeNull();
  });

  it('redirects the removed /overview route to the chat, keeping the query string', async () => {
    renderAt(`/agents/${AGENT_ID}/overview?tab=channels`);
    await locationIs(`/agents/${AGENT_ID}/threads/new?tab=channels`);
  });

  it('redirects the legacy /settings route to the chat', async () => {
    renderAt(`/agents/${AGENT_ID}/settings`);
    await locationIs(`/agents/${AGENT_ID}/threads/new`);
  });
});
