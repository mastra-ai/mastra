// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AgentThreadSidebar } from '../memory-sidebar/agent-thread-sidebar';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function renderSidebar(showConfigBadges?: boolean) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: true })),
    http.get(`${TEST_BASE_URL}/api/memory/config`, () =>
      HttpResponse.json({ config: { lastMessages: 10, semanticRecall: true } }),
    ),
  );
  return renderWithProviders(
    <AgentThreadSidebar agentId="support" threadList={<div />} showConfigBadges={showConfigBadges} />,
  );
}

describe('AgentThreadSidebar config badges', () => {
  it('shows the badges by default', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('memory-config-badges')).toBeTruthy());
  });

  it('hides the badges when the host opts out', async () => {
    renderSidebar(false);
    await screen.findByText('Memory');
    expect(screen.queryByTestId('memory-config-badges')).toBeNull();
  });
});
