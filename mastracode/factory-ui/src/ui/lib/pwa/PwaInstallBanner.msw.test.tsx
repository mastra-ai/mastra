import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BeforeInstallPromptEvent } from './usePwaInstall';
import { PwaInstallBanner } from './PwaInstallBanner';

const DISMISSED_KEY = 'mastracode.pwaInstallDismissedAt';
const INSTALLED_KEY = 'mastracode.pwaInstalledManually';

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const originalUserAgent = navigator.userAgent;
const originalMatchMedia = window.matchMedia;

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
}

function setStandalone(standalone: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

function fireInstallPromptEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
  });
  act(() => void window.dispatchEvent(event));
  return { prompt };
}

beforeEach(() => {
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(INSTALLED_KEY);
});

afterEach(() => {
  setUserAgent(originalUserAgent);
  window.matchMedia = originalMatchMedia;
});

describe('PwaInstallBanner', () => {
  it('renders nothing when no install path is available', () => {
    render(<PwaInstallBanner />);
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('shows the banner once the native install prompt is available', () => {
    render(<PwaInstallBanner />);
    fireInstallPromptEvent();

    expect(screen.getByRole('region', { name: 'Install app' })).toBeInTheDocument();
    expect(screen.getByText('Install app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('triggers the native prompt when Install is clicked', async () => {
    const user = userEvent.setup();
    render(<PwaInstallBanner />);
    const { prompt } = fireInstallPromptEvent();

    await user.click(screen.getByRole('button', { name: 'Install' }));

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('hides and persists the dismissal when Not now is clicked', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PwaInstallBanner />);
    fireInstallPromptEvent();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).not.toBeNull();

    // Still hidden on a fresh render, even if the browser refires the event.
    unmount();
    render(<PwaInstallBanner />);
    fireInstallPromptEvent();
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('opens iOS instructions on Install and marks the app manually installed', async () => {
    setUserAgent(IOS_UA);
    const user = userEvent.setup();
    const { unmount } = render(<PwaInstallBanner />);

    expect(screen.getByRole('region', { name: 'Install app' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Install' }));

    expect(screen.getByRole('dialog', { name: 'Install this app' })).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(localStorage.getItem(INSTALLED_KEY)).toBe('true');

    // Banner is gone on the next visit.
    unmount();
    render(<PwaInstallBanner />);
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('adapts the instructions wording to Chrome on iOS', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    );
    const user = userEvent.setup();
    render(<PwaInstallBanner />);

    await user.click(screen.getByRole('button', { name: 'Install' }));

    expect(screen.getByText(/Chrome’s address bar/)).toBeInTheDocument();
    expect(screen.queryByText(/Safari’s toolbar/)).not.toBeInTheDocument();
  });

  it('renders nothing when running standalone', () => {
    setStandalone(true);
    render(<PwaInstallBanner />);
    fireInstallPromptEvent();
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument();
  });
});
