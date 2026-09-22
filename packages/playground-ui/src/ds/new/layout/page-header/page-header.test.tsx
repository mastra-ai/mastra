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

  it('renders the legacy prop API', () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Legacy title" description="Legacy description" icon="Legacy icon" />,
    );

    expect(markup).toContain('Legacy title');
    expect(markup).toContain('Legacy description');
    expect(markup).toContain('Legacy icon');
  });

  it('hides legacy content while loading', () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Legacy title" description="Legacy description" icon="Legacy icon" isLoading />,
    );

    expect(markup).not.toContain('Legacy title');
    expect(markup).not.toContain('Legacy description');
    expect(markup).not.toContain('Legacy icon');
  });

  it('supports beside metadata', () => {
    const markup = renderToStaticMarkup(<PageHeader.Meta beside>Live</PageHeader.Meta>);

    expect(markup).toContain('data-placement="beside"');
  });

  it('renders an empty header', () => {
    expect(renderToStaticMarkup(<PageHeader />)).toContain('<header');
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
    expect(tallActionTitleClass).toContain('self-start');
  });
});
