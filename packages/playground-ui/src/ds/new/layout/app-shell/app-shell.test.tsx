import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from './app-shell';
import { MainCard } from './main-card';

function renderShell({
  edgeToEdge,
  mobileHeader = true,
  sidebar = false,
}: { edgeToEdge?: boolean; mobileHeader?: boolean; sidebar?: boolean } = {}) {
  return renderToStaticMarkup(
    <AppShell
      edgeToEdge={edgeToEdge}
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

function transitionClasses(classes: string[]) {
  return classes.filter(className => className.includes('transition'));
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
      expect(bodyClassName(markup)).toContain('lg:py-2 lg:pr-2 lg:pl-0');
    });

    it('does not inset the body below lg, where the sidebar is a drawer', () => {
      const unscopedPadding = bodyClassName(markup)
        .split(/\s+/)
        .filter(className => /^(max-lg:)?p[trblxy]?-/.test(className));
      expect(unscopedPadding).toEqual([]);
    });

    it('never mixes padding shorthands with longhands, so consumer CSS order cannot override the lg inset', () => {
      const classes = bodyClassName(markup).split(/\s+/);
      expect(classes).not.toContain('p-1.5');
      expect(classes).not.toContain('lg:p-2');
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

    it('insets the body on all sides from lg', () => {
      expect(bodyClassName(markup)).toContain('lg:py-2 lg:pr-2 lg:pl-2');
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

  describe('when edge to edge', () => {
    it.each([{ sidebar: true }, { sidebar: false }])('drops every lg inset, sidebar: $sidebar', ({ sidebar }) => {
      const padding = bodyClassName(renderShell({ edgeToEdge: true, sidebar }))
        .split(/\s+/)
        .filter(className => /^(lg:)?p[trblxy]?-/.test(className));
      expect(padding).toEqual([]);
    });
  });

  describe('inset animation', () => {
    it('stays static for apps that leave edgeToEdge out', () => {
      expect(transitionClasses(bodyClassName(renderShell({ sidebar: true })).split(/\s+/))).toEqual([]);
    });

    it.each([true, false])('animates both ways for apps that pass edgeToEdge, edgeToEdge: %s', edgeToEdge => {
      expect(transitionClasses(bodyClassName(renderShell({ edgeToEdge, sidebar: true })).split(/\s+/))).not.toEqual([]);
    });
  });
});

function mainCardClasses({ edgeToEdge }: { edgeToEdge?: boolean } = {}) {
  return (
    renderToStaticMarkup(<MainCard edgeToEdge={edgeToEdge}>Content</MainCard>)
      .match(/data-slot="main-card" class="([^"]*)"/)?.[1]
      ?.split(/\s+/) ?? []
  );
}

describe('MainCard', () => {
  const classes = mainCardClasses();

  it('frames the content only from lg, where the sidebar sits beside it', () => {
    expect(classes).toEqual(expect.arrayContaining(['lg:rounded-studio-frame', 'lg:p-px', 'lg:shadow-raised']));
  });

  it('is flat below lg: no rounding, rim padding or elevation outside the lg variant', () => {
    const frameClasses = classes.filter(className => /^(max-lg:)?(rounded|p-|shadow)/.test(className));
    expect(frameClasses).toEqual([]);
  });

  it('drops the frame when edge to edge', () => {
    const frameClasses = mainCardClasses({ edgeToEdge: true }).filter(className =>
      /^(lg:)?(rounded|p-|shadow)/.test(className),
    );
    expect(frameClasses).toEqual([]);
  });

  it('stays static for apps that leave edgeToEdge out', () => {
    expect(transitionClasses(classes)).toEqual([]);
  });

  it.each([true, false])('animates the frame both ways for apps that pass edgeToEdge, edgeToEdge: %s', edgeToEdge => {
    expect(transitionClasses(mainCardClasses({ edgeToEdge }))).not.toEqual([]);
  });
});
