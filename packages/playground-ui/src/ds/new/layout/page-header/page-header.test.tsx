import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './page-header';
import { PageHeader as LegacyPageHeader } from '@/ds/components/PageHeader';

describe('PageHeader', () => {
  it('keeps the legacy entry point', () => {
    expect(LegacyPageHeader).toBe(PageHeader);
  });

  it('renders every compound slot', () => {
    const markup = renderToStaticMarkup(
      <PageHeader aria-label="Project header">
        <PageHeader.Icon>Icon</PageHeader.Icon>
        <PageHeader.Title>Production</PageHeader.Title>
        <PageHeader.Meta>Live</PageHeader.Meta>
        <PageHeader.Description>Production environment</PageHeader.Description>
        <PageHeader.Action>Edit</PageHeader.Action>
      </PageHeader>,
    );

    expect(markup).toContain('<header');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Icon');
    expect(markup).toContain('Production');
    expect(markup).toContain('Live');
    expect(markup).toContain('Production environment');
    expect(markup).toContain('Edit');
  });

  it('renders the title before beside metadata regardless of child order', () => {
    const markup = renderToStaticMarkup(
      <PageHeader>
        <PageHeader.Meta beside>Live</PageHeader.Meta>
        <PageHeader.Title>Production</PageHeader.Title>
      </PageHeader>,
    );

    expect(markup.indexOf('Production')).toBeLessThan(markup.indexOf('Live'));
  });

  it('supports beside metadata', () => {
    const markup = renderToStaticMarkup(<PageHeader.Meta beside>Live</PageHeader.Meta>);

    expect(markup).toContain('data-placement="beside"');
  });

  it('renders an empty header', () => {
    expect(renderToStaticMarkup(<PageHeader />)).toContain('<header');
  });

  it('renders the action outside the title column, aligned to the top', () => {
    const markup = renderToStaticMarkup(
      <PageHeader>
        <PageHeader.Title>Environment</PageHeader.Title>
        <PageHeader.Action>Edit</PageHeader.Action>
      </PageHeader>,
    );

    expect(markup).toMatch(
      /<\/h1><\/div><\/div><div data-slot="page-header-action" class="[^"]*self-start[^"]*">Edit<\/div><\/div><\/header>$/,
    );
  });

  it('keeps the title anchored to the top of the row regardless of action height', () => {
    const withTallAction = renderToStaticMarkup(
      <PageHeader>
        <PageHeader.Title>Environment</PageHeader.Title>
        <PageHeader.Action>
          <div style={{ height: 120 }}>Tall action</div>
        </PageHeader.Action>
      </PageHeader>,
    );

    const withoutAction = renderToStaticMarkup(
      <PageHeader>
        <PageHeader.Title>Environment</PageHeader.Title>
      </PageHeader>,
    );

    const titleClass = (markup: string) => markup.match(/<h1[^>]*class="([^"]*)"/)?.[1];
    const tallActionTitleClass = titleClass(withTallAction);
    const noActionTitleClass = titleClass(withoutAction);

    expect(tallActionTitleClass).toBeDefined();
    expect(tallActionTitleClass).toEqual(noActionTitleClass);
  });

  it('renders the eyebrow above the title row, outside the title column', () => {
    const markup = renderToStaticMarkup(
      <PageHeader>
        <PageHeader.Title>Create alert</PageHeader.Title>
        <PageHeader.Eyebrow>
          <a href="/alerts">Back to alerts</a>
        </PageHeader.Eyebrow>
        <PageHeader.Action>Save</PageHeader.Action>
      </PageHeader>,
    );

    expect(markup).toMatch(
      /^<header[^>]*><div [^>]*data-slot="page-header-eyebrow"[^>]*><a href="\/alerts">Back to alerts<\/a><\/div>/,
    );
  });
});
