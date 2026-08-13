import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { SessionFavicon } from '../SessionFavicon';

function faviconHref() {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute('href');
}

function renderFavicon(props: { sessionOpen: boolean; starting: boolean; busy: boolean }) {
  return renderWithProviders(<SessionFavicon {...props} />);
}

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/mastra.svg">';
});

describe('SessionFavicon', () => {
  describe('when a session route is starting', () => {
    it('shows the orange startup indicator', () => {
      renderFavicon({ sessionOpen: true, starting: true, busy: false });

      expect(faviconHref()).toBe('/favicon-session-starting.svg');
    });
  });

  describe('when an agent is working', () => {
    it('shows the green activity indicator', () => {
      renderFavicon({ sessionOpen: true, starting: false, busy: true });

      expect(faviconHref()).toBe('/favicon-session-working.svg');
    });
  });

  describe('when the agent turn is complete', () => {
    it('shows the green completion check', () => {
      renderFavicon({ sessionOpen: true, starting: false, busy: false });

      expect(faviconHref()).toBe('/favicon-session-complete.svg');
    });
  });

  describe('when no session is open', () => {
    it('keeps the normal Mastra favicon', () => {
      renderFavicon({ sessionOpen: false, starting: false, busy: false });

      expect(faviconHref()).toBe('/mastra.svg');
    });
  });
});
