import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from './app-shell';

function renderShell({
  mobileHeader = true,
  routeHeader = true,
}: { mobileHeader?: boolean; routeHeader?: boolean } = {}) {
  return renderToStaticMarkup(
    <AppShell
      sidebar={<aside>Sidebar</aside>}
      mainLabel="Page content"
      mobileHeader={mobileHeader ? <header>Mobile header</header> : undefined}
      routeHeader={routeHeader ? <header>Route header</header> : undefined}
    >
      <main>Main content</main>
    </AppShell>,
  );
}

describe('AppShell', () => {
  describe('when every slot is provided', () => {
    it('composes the sidebar, mobile header, route header, and main content', () => {
      const markup = renderShell();

      expect(markup).toContain('data-slot="app-shell"');
      expect(markup).toContain('Sidebar');
      expect(markup).toContain('Mobile header');
      expect(markup).toContain('Route header');
      expect(markup).toContain('Main content');
    });

    it('places the route header above the main content', () => {
      const markup = renderShell();

      expect(markup.indexOf('Route header')).toBeLessThan(markup.indexOf('Main content'));
    });

    it('keeps the main content in a keyboard-accessible independent scroll region', () => {
      const markup = renderShell();

      expect(markup).toContain('data-slot="app-shell-main" aria-label="Page content" role="group" tabindex="0"');
      expect(markup).toContain('class="min-h-0 overflow-y-auto"');
    });
  });

  describe('when the mobile header is omitted', () => {
    it('renders the remaining slots', () => {
      const markup = renderShell({ mobileHeader: false });

      expect(markup).not.toContain('Mobile header');
      expect(markup).toContain('Route header');
      expect(markup).toContain('Main content');
    });
  });

  describe('when the route header is omitted', () => {
    it('gives the main content the full frame', () => {
      const markup = renderShell({ routeHeader: false });

      expect(markup).not.toContain('Route header');
      expect(markup).toContain('grid-rows-[1fr]');
      expect(markup).toContain('Main content');
    });
  });
});
