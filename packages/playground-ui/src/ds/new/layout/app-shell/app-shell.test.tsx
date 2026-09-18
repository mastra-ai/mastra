import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from './app-shell';

function renderShell({
  mobileHeader = true,
  routeHeader = true,
}: { mobileHeader?: boolean; routeHeader?: boolean } = {}) {
  return renderToStaticMarkup(
    <AppShell
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
    it('composes the mobile header, route header, and main content', () => {
      const markup = renderShell();

      expect(markup).toContain('data-slot="app-shell"');
      expect(markup).toContain('Mobile header');
      expect(markup).toContain('Route header');
      expect(markup).toContain('Main content');
    });

    it('places the route header above the main content', () => {
      const markup = renderShell();

      expect(markup.indexOf('Route header')).toBeLessThan(markup.indexOf('Main content'));
    });

    it('supports a consumer-owned frame wrapper', () => {
      const markup = renderToStaticMarkup(
        <AppShell
          mainLabel="Page content"
          renderFrame={({ children, className }) => (
            <section aria-label="Frame wrapper" className={className}>
              {children}
            </section>
          )}
        >
          Main content
        </AppShell>,
      );

      expect(markup).toContain('<section aria-label="Frame wrapper" class="flex min-h-0 flex-1 flex-col">');
      expect(markup).toContain('data-slot="app-shell-frame"');
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

  describe('when mainClassName is provided', () => {
    it('extends the scroll container without dropping its own classes', () => {
      const markup = renderToStaticMarkup(
        <AppShell mainLabel="Page content" mainClassName="grid grid-rows-[1fr] content-start">
          Main content
        </AppShell>,
      );

      expect(markup).toContain('class="min-h-0 overflow-y-auto grid grid-rows-[1fr] content-start"');
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
