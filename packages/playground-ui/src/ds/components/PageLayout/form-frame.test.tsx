// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLayout } from './index';

afterEach(cleanup);

describe('PageLayout variant="form"', () => {
  it('shows a back link and the page title, with no breadcrumb bar', () => {
    render(
      <PageLayout variant="form" backHref="/alerts" backLabel="Alerts" title="New alert">
        <section>Conditions</section>
      </PageLayout>,
    );

    const back = screen.getByRole('link', { name: 'Back to Alerts' });
    expect(back.getAttribute('href')).toBe('/alerts');
    expect(back.textContent).toBe('Alerts');
    expect(screen.getByRole('heading', { level: 1, name: 'New alert' })).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const main = screen.getByRole('main');
    expect(main.closest('[data-slot="page-layout"]')?.firstElementChild).toBe(main);
    expect(main.textContent).toContain('Conditions');
  });

  it('shows only the title when the form has no back link', () => {
    render(
      <PageLayout variant="form" title="New skill">
        <section>Fields</section>
      </PageLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'New skill' })).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('puts the back link above the title', () => {
    render(
      <PageLayout variant="form" backHref="/alerts" backLabel="Alerts" title="New alert">
        <section>Conditions</section>
      </PageLayout>,
    );

    const back = screen.getByRole('link', { name: 'Back to Alerts' });
    const title = screen.getByRole('heading', { level: 1 });
    expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks the title busy while the page loads', () => {
    render(
      <PageLayout variant="form" backHref="/alerts/1" backLabel="Alert" title="Edit alert" isLoading>
        <section>Conditions</section>
      </PageLayout>,
    );

    const title = screen.getByRole('heading', { level: 1 });
    expect(title.getAttribute('aria-busy')).toBe('true');
    expect(title.textContent).not.toContain('Edit alert');
  });

  it("renders the back link through the app's link component", () => {
    function RouterLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
      return <a data-router-link {...props} />;
    }

    render(
      <PageLayout
        variant="form"
        backHref="/projects"
        backLabel="Projects"
        title="New project"
        LinkComponent={RouterLink}
      >
        <section>Repository</section>
      </PageLayout>,
    );

    const back = screen.getByRole('link', { name: 'Back to Projects' });
    expect(back.hasAttribute('data-router-link')).toBe(true);
    expect(back.getAttribute('href')).toBe('/projects');
  });

  it('puts the aside after the title and before the form, so small screens show it above the fields', () => {
    render(
      <PageLayout variant="form" backHref="/alerts" backLabel="Alerts" title="New alert" aside={<p>Backtest</p>}>
        <label>
          Name
          <input />
        </label>
      </PageLayout>,
    );

    const title = screen.getByRole('heading', { level: 1 });
    const aside = screen.getByText('Backtest');
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect(title.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aside.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
