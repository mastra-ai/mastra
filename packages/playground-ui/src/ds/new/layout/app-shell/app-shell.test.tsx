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

function bodyClassName(markup: string) {
  return markup.match(/data-slot="app-shell-body" class="([^"]*)"/)?.[1] ?? '';
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
      expect(markup).toContain('data-slot="app-shell" class="h-full min-h-0 lg:grid lg:grid-cols-[auto_minmax(0,1fr)]');
    });

    it('lets wide content scroll inside itself instead of widening the content column', () => {
      expect(markup).toMatch(/data-slot="app-shell-content" class="[^"]*\bmin-w-0\b/);
    });

    it('drops the left inset at lg so the sidebar padding provides the gap', () => {
      expect(bodyClassName(markup)).toContain('max-lg:p-1.5 lg:pr-2 lg:pb-2 lg:pl-0');
    });

    it('never mixes padding shorthands with longhands, so consumer CSS order cannot override the lg inset', () => {
      const classes = bodyClassName(markup).split(/\s+/);
      expect(classes).not.toContain('p-1.5');
      expect(classes).not.toContain('lg:p-2');
    });

    it('insets the whole grid from the top, so the sidebar starts level with the content', () => {
      expect(markup).toMatch(/data-slot="app-shell" class="[^"]*\blg:pt-2\b/);
      expect(bodyClassName(markup)).not.toMatch(/\blg:(py|pt)-/);
    });

    it('keeps the mobile header outside the inset body', () => {
      expect(markup.indexOf('Mobile header')).toBeLessThan(markup.indexOf('data-slot="app-shell-body"'));
    });
  });

  describe('when the sidebar is omitted', () => {
    const markup = renderShell();

    it('does not reserve a sidebar column', () => {
      expect(markup).not.toContain('lg:grid-cols-');
    });

    it('insets the body on all sides', () => {
      expect(markup).toMatch(/data-slot="app-shell" class="[^"]*\blg:pt-2\b/);
      expect(bodyClassName(markup)).toContain('max-lg:p-1.5 lg:pr-2 lg:pb-2 lg:pl-2');
      expect(bodyClassName(markup)).not.toContain('lg:pl-0');
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
