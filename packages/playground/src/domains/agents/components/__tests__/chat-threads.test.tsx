import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeAllowedCapabilities } from '../../hooks/__tests__/fixtures/auth';
import { ChatThreads } from '../chat-threads';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  // `usePermissions` inside ChatThreads fetches auth capabilities.
  server.use(http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)));
});

const renderThreads = (onHidePanel?: () => void) =>
  renderWithProviders(
    <TestLinkProvider>
      <ChatThreads
        threads={[]}
        threadId="thread-1"
        onDelete={() => {}}
        resourceId="agent-1"
        resourceType="agent"
        onHidePanel={onHidePanel}
      />
    </TestLinkProvider>,
  );

describe('ChatThreads — hide threads panel', () => {
  it('offers no hide control when the panel cannot be hidden', () => {
    renderThreads();

    expect(screen.getByRole('link', { name: 'New Chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide threads panel' })).toBeNull();
  });

  it('places a hide control on the New Chat row and reports the click', () => {
    const onHidePanel = vi.fn();
    renderThreads(onHidePanel);

    const hideButton = screen.getByRole('button', { name: 'Hide threads panel' });
    const newChat = screen.getByRole('link', { name: 'New Chat' });
    expect(hideButton.parentElement).toBe(newChat.parentElement);

    fireEvent.click(hideButton);

    expect(onHidePanel).toHaveBeenCalledTimes(1);
  });
});
