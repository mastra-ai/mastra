import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from './app-shell';

function renderShell({ mobileHeader = true, sidebar = false }: { mobileHeader?: boolean; sidebar?: boolean } = {}) {
  return renderToStaticMarkup(
    <AppShell
      mobileHeader={mobileHeader ? <header>Mobile header</header> : undefined}
      sidebar={sidebar ? <nav>Sidebar</nav> : undefined}
    >
      <main>Main content</main>
    </AppShell>,
  );
}

describe('AppShell', () => {
  describe('when every slot is provided', () => {
    it('composes the sidebar, mobile header, and content', () => {
      const markup = renderShell({ sidebar: true });

      expect(markup).toContain('data-slot="app-shell"');
      expect(markup).toContain('Sidebar');
      expect(markup).toContain('Mobile header');
      expect(markup).toContain('Main content');
    });

    it('places the mobile header above the content', () => {
      const markup = renderShell();

      expect(markup.indexOf('Mobile header')).toBeLessThan(markup.indexOf('Main content'));
    });
  });

  describe('when a sidebar is provided', () => {
    const markup = renderShell({ sidebar: true });

    it('renders the sidebar before the content', () => {
      expect(markup.indexOf('Sidebar')).toBeLessThan(markup.indexOf('Main content'));
    });

    it('lays the sidebar and content out as a desktop grid', () => {
      expect(markup).toContain('data-slot="app-shell" class="h-full min-h-0 lg:grid lg:grid-cols-[auto_1fr]');
    });
  });

  describe('when the sidebar is omitted', () => {
    it('does not reserve a sidebar column', () => {
      expect(renderShell()).not.toContain('lg:grid-cols-[auto_1fr]');
    });
  });

  describe('when the mobile header is omitted', () => {
    it('renders the remaining slots', () => {
      const markup = renderShell({ mobileHeader: false });

      expect(markup).not.toContain('Mobile header');
      expect(markup).toContain('Main content');
    });
  });
});
