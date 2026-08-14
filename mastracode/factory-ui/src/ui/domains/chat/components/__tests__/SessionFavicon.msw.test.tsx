import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { SessionFavicon } from '../SessionFavicon';

function faviconHref() {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute('href');
}

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/mastra.svg">';
});

describe('SessionFavicon', () => {
  describe('when the session is still preparing', () => {
    it('shows the amber initializing indicator', () => {
      renderWithProviders(<SessionFavicon state="initializing" />);

      expect(faviconHref()).toBe('/favicon-session-initializing.svg');
    });
  });

  describe('when the agent is working', () => {
    it('shows the green activity indicator', () => {
      renderWithProviders(<SessionFavicon state="working" />);

      expect(faviconHref()).toBe('/favicon-session-working.svg');
    });
  });

  describe('when the session is waiting on the user', () => {
    it('shows the blue awaiting indicator', () => {
      renderWithProviders(<SessionFavicon state="awaiting" />);

      expect(faviconHref()).toBe('/favicon-session-awaiting.svg');
    });
  });

  describe('when the session has errored', () => {
    it('shows the red error indicator', () => {
      renderWithProviders(<SessionFavicon state="error" />);

      expect(faviconHref()).toBe('/favicon-session-error.svg');
    });
  });

  describe('when no session is on screen', () => {
    it('keeps the normal Mastra favicon', () => {
      renderWithProviders(<SessionFavicon state={null} />);

      expect(faviconHref()).toBe('/mastra.svg');
    });
  });

  describe('when the session leaves the screen', () => {
    it('restores the normal Mastra favicon', () => {
      const { unmount } = renderWithProviders(<SessionFavicon state="working" />);
      unmount();

      expect(faviconHref()).toBe('/mastra.svg');
    });
  });

  describe('when preparation finishes on a session that was already awaiting', () => {
    it('keeps the awaiting indicator instead of falling back to the default', () => {
      const { rerender } = renderWithProviders(<SessionFavicon state="awaiting" />);
      rerender(<SessionFavicon state="initializing" />);
      rerender(<SessionFavicon state="awaiting" />);

      expect(faviconHref()).toBe('/favicon-session-awaiting.svg');
    });
  });
});
