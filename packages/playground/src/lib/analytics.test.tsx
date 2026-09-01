import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PostHogProvider } from './analytics';

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: posthogMock,
}));

vi.mock('@posthog/react', () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function setHostname(hostname: string) {
  vi.stubGlobal('location', {
    ...window.location,
    hostname,
  });
}

function setBrave(value: unknown) {
  Object.defineProperty(navigator, 'brave', {
    configurable: true,
    value,
  });
}

function clearBrave() {
  delete (navigator as Navigator & { brave?: unknown }).brave;
}

afterEach(() => {
  cleanup();
  posthogMock.init.mockReset();
  posthogMock.register.mockReset();
  delete window.MASTRA_TELEMETRY_DISABLED;
  clearBrave();
  setHostname('localhost');
});

describe('PostHogProvider', () => {
  it('initializes PostHog on localhost', async () => {
    setHostname('localhost');

    render(
      <PostHogProvider>
        <div>Playground</div>
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthogMock.init).toHaveBeenCalledWith('phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT', {
        api_host: 'https://us.posthog.com',
      });
    });
    expect(posthogMock.register).toHaveBeenCalledWith({ mastraSource: 'playground' });
  });

  it('initializes PostHog regardless of hostname', async () => {
    for (const hostname of ['mastra.cloud', 'foo.mastra.cloud', 'foo.example.com', 'self-hosted.internal']) {
      setHostname(hostname);

      const { unmount } = render(
        <PostHogProvider>
          <div>Playground</div>
        </PostHogProvider>,
      );

      await waitFor(() => expect(posthogMock.init).toHaveBeenCalledTimes(1));
      expect(posthogMock.register).toHaveBeenCalledWith({ mastraSource: 'playground' });
      unmount();
      posthogMock.init.mockReset();
      posthogMock.register.mockReset();
    }
  });

  it('does not initialize PostHog when telemetry is disabled', async () => {
    window.MASTRA_TELEMETRY_DISABLED = 'true';

    render(
      <PostHogProvider>
        <div>Playground</div>
      </PostHogProvider>,
    );

    await waitFor(() => expect(posthogMock.init).not.toHaveBeenCalled());
    expect(posthogMock.register).not.toHaveBeenCalled();
  });

  it('does not initialize PostHog in Brave', async () => {
    setBrave({});

    render(
      <PostHogProvider>
        <div>Playground</div>
      </PostHogProvider>,
    );

    await waitFor(() => expect(posthogMock.init).not.toHaveBeenCalled());
    expect(posthogMock.register).not.toHaveBeenCalled();
  });
});
