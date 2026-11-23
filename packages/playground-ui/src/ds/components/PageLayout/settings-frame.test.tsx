import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageLayout } from './index';

describe('PageLayout variant="settings"', () => {
  it('renders the page title, accessory, action, and sections', () => {
    const output = renderToStaticMarkup(
      <PageLayout
        variant="settings"
        title="Project settings"
        titleAccessory={<span>Studio</span>}
        action={<button type="button">Save</button>}
      >
        <section>General settings</section>
      </PageLayout>,
    );

    expect(output).toContain('<h1');
    expect(output).toContain('Project settings');
    expect(output).toContain('<span>Studio</span>');
    expect(output).toContain('<button type="button">Save</button>');
    expect(output).toContain('data-slot="settings-layout-content"');
    expect(output).toContain('General settings');
  });

  it('leaves the title out when the app already names the page', () => {
    const output = renderToStaticMarkup(
      <PageLayout variant="settings">
        <section>General settings</section>
      </PageLayout>,
    );

    expect(output).not.toContain('<h1');
    expect(output).toContain('General settings');
  });

  it('renders an app header in place of the title, with the same inset', () => {
    const output = renderToStaticMarkup(
      <PageLayout variant="settings" title="Ignored" header={<h1 id="announced">Repositories</h1>}>
        <section>Sections</section>
      </PageLayout>,
    );

    expect(output).toContain('data-slot="settings-page-header"');
    expect(output).toContain('<h1 id="announced">Repositories</h1>');
    expect(output).not.toContain('Ignored');
    expect(output.match(/<h1/g)).toHaveLength(1);
  });

  it('owns the page frame, with the breadcrumb bar when given breadcrumbs', () => {
    const output = renderToStaticMarkup(
      <PageLayout variant="settings" breadcrumbs={<nav aria-label="Breadcrumb">Settings</nav>} title="Members">
        <section>Sections</section>
      </PageLayout>,
    );

    const breadcrumb = output.indexOf('aria-label="Breadcrumb"');
    const main = output.indexOf('<main');
    const settings = output.indexOf('data-slot="settings-layout"');

    expect(output).toContain('data-slot="page-layout"');
    expect(breadcrumb).toBeGreaterThanOrEqual(0);
    expect(main).toBeGreaterThan(breadcrumb);
    expect(settings).toBeGreaterThan(main);
  });
});
