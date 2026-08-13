import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { SessionFavicon, SessionFaviconStarting } from '../SessionFavicon';

function faviconHref() {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute('href');
}

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/mastra.svg">';
});

describe('SessionFaviconStarting', () => {
  describe('when the session prepare stepper is showing', () => {
    it('shows the orange startup indicator', () => {
      renderWithProviders(<SessionFaviconStarting />);

      expect(faviconHref()).toBe('/favicon-session-starting.svg');
    });
  });

  describe('when the session prepare stepper unmounts', () => {
    it('restores the normal Mastra favicon', () => {
      const { unmount } = renderWithProviders(<SessionFaviconStarting />);
      unmount();

      expect(faviconHref()).toBe('/mastra.svg');
    });
  });
});

describe('SessionFavicon', () => {
  describe('when an agent is working', () => {
    it('shows the green activity indicator', () => {
      renderWithProviders(<SessionFavicon sessionOpen busy />);

      expect(faviconHref()).toBe('/favicon-session-working.svg');
    });
  });

  describe('when the agent turn is complete', () => {
    it('shows the green completion check', () => {
      renderWithProviders(<SessionFavicon sessionOpen busy={false} />);

      expect(faviconHref()).toBe('/favicon-session-complete.svg');
    });
  });

  describe('when no session is open', () => {
    it('keeps the normal Mastra favicon', () => {
      renderWithProviders(<SessionFavicon sessionOpen={false} busy={false} />);

      expect(faviconHref()).toBe('/mastra.svg');
    });
  });
});
