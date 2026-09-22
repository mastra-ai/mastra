import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageShell } from './page-shell';

describe('PageShell', () => {
  describe('when every slot is provided', () => {
    it('composes the icon, title, description, action, and main content', () => {
      const markup = renderToStaticMarkup(
        <PageShell
          title="Research agent"
          icon={<span>Icon</span>}
          description="Configuration"
          action={<button>Edit</button>}
        >
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).toContain('data-slot="page-header-icon"');
      expect(markup).toContain('data-slot="page-header-title"');
      expect(markup).toContain('data-slot="page-header-description"');
      expect(markup).toContain('data-slot="page-header-action"');
      expect(markup).toContain('Research agent');
      expect(markup).toContain('Icon');
      expect(markup).toContain('Configuration');
      expect(markup).toContain('Edit');
      expect(markup).toContain('Main content');
    });
  });

  describe('when meta is provided', () => {
    it('renders it as a beside meta slot between description and action', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent" meta={<span>Read only</span>} action={<button>Edit</button>}>
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).toContain('data-slot="page-header-meta"');
      expect(markup).toContain('data-placement="beside"');
      expect(markup).toContain('Read only');
    });
  });

  describe('when optional slots are omitted', () => {
    it('renders only the title and main content', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent">
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).not.toContain('data-slot="page-header-icon"');
      expect(markup).not.toContain('data-slot="page-header-description"');
      expect(markup).not.toContain('data-slot="page-header-meta"');
      expect(markup).not.toContain('data-slot="page-header-action"');
      expect(markup).toContain('Research agent');
      expect(markup).toContain('Main content');
    });
  });

  describe('when isLoading is true', () => {
    it('passes isLoading through to the title', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent" isLoading>
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).not.toContain('Research agent');
      expect(markup).toContain('animate-pulse');
    });

    it('passes isLoading through to the description', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent" description="Configuration" isLoading>
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).toContain('data-slot="page-header-description"');
      expect(markup).not.toContain('Configuration');

      const descriptionMarkup = markup.slice(markup.indexOf('data-slot="page-header-description"'));
      expect(descriptionMarkup).toContain('animate-pulse');
    });

    it('hides the icon', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent" icon={<span>Icon</span>} isLoading>
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).not.toContain('data-slot="page-header-icon"');
      expect(markup).not.toContain('Icon');
    });
  });

  describe('width, height, and className', () => {
    it('defaults to wide, full height, and px-6', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent">
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).toContain('px-6');
      expect(markup).toContain('h-full');
    });

    it('supports overriding width, height, and className', () => {
      const markup = renderToStaticMarkup(
        <PageShell title="Research agent" width="narrow" height="default" className="px-2">
          <main>Main content</main>
        </PageShell>,
      );

      expect(markup).toContain('max-w-screen-lg');
      expect(markup).not.toContain('h-full');
      expect(markup).toContain('px-2');
      expect(markup).not.toContain('px-6');
    });
  });
});
