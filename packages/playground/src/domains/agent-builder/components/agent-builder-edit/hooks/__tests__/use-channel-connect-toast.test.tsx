// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChannelConnectToast } from '../use-channel-connect-toast';

const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: {
      success: (...args: unknown[]) => successMock(...args),
      error: (...args: unknown[]) => errorMock(...args),
    },
  };
});

let capturedLocation: ReturnType<typeof useLocation> | null = null;

function Harness() {
  useChannelConnectToast();
  capturedLocation = useLocation();
  return null;
}

const renderAt = (initialUrl: string) =>
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );

describe('useChannelConnectToast', () => {
  afterEach(() => {
    cleanup();
    successMock.mockReset();
    errorMock.mockReset();
    capturedLocation = null;
  });

  it('shows a success toast and strips params when channel_connected=true', () => {
    renderAt('/?channel_connected=true&platform=slack&agent=agent-1&team=Acme');

    expect(successMock).toHaveBeenCalledTimes(1);
    const message = successMock.mock.calls[0][0] as string;
    expect(message).toContain('Slack');
    expect(message).toContain('Acme');
    expect(errorMock).not.toHaveBeenCalled();

    expect(capturedLocation?.search ?? '').not.toContain('channel_connected');
    expect(capturedLocation?.search ?? '').not.toContain('platform=');
    expect(capturedLocation?.search ?? '').not.toContain('agent=');
    expect(capturedLocation?.search ?? '').not.toContain('team=');
  });

  it('shows an error toast and strips params when channel_error is present', () => {
    renderAt('/?channel_error=denied&platform=slack&agent=agent-1');

    expect(errorMock).toHaveBeenCalledTimes(1);
    const message = errorMock.mock.calls[0][0] as string;
    expect(message).toContain('Slack');
    expect(message).toContain('denied');
    expect(successMock).not.toHaveBeenCalled();

    expect(capturedLocation?.search ?? '').not.toContain('channel_error');
    expect(capturedLocation?.search ?? '').not.toContain('platform=');
  });

  it('does not toast when no channel params are present', () => {
    renderAt('/agent-builder/agents/abc/view');

    expect(successMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('does not double-fire under React strict-mode style remounts', () => {
    const { rerender } = renderAt('/?channel_connected=true&platform=slack&team=Acme');

    rerender(
      <MemoryRouter initialEntries={['/?channel_connected=true&platform=slack&team=Acme']}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(successMock).toHaveBeenCalledTimes(1);
  });
});
