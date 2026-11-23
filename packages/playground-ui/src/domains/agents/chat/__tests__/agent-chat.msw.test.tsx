// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AgentChat } from '../agent-chat';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('../chat-provider', () => ({ ChatProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../thread', () => ({ Thread: () => <textarea placeholder="Enter your message" /> }));

function renderChat(status: number) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/memory/threads/:threadId/messages`, () =>
      HttpResponse.json({ error: 'failed' }, { status }),
    ),
  );
  return renderWithProviders(<AgentChat agentId="support" threadId="1234" memory />);
}

describe('AgentChat', () => {
  it('shows the composer for a thread that has no messages yet', async () => {
    renderChat(404);
    expect(await screen.findByPlaceholderText('Enter your message')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers a retry when history fails to load', async () => {
    renderChat(500);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Enter your message')).toBeNull();
  });
});
