import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsLayout } from './settings-layout';

describe('SettingsLayout', () => {
  it('renders the page title, action, and settings content', () => {
    const output = renderToStaticMarkup(
      <SettingsLayout
        title="Project Settings"
        titleAccessory={<span>Studio</span>}
        description="Manage your project configuration."
        action={<button type="button">Save</button>}
      >
        <section>General settings</section>
      </SettingsLayout>,
    );

    expect(output).toContain('<h1');
    expect(output).toContain('Project Settings');
    expect(output).toContain('<span>Studio</span>');
    expect(output).toContain('data-slot="settings-page-header"');
    expect(output).toContain('flex min-w-0 flex-wrap items-start justify-between gap-4');
    expect(output).not.toContain('pl-4');
    expect(output).toContain('flex min-w-0 items-center gap-2');
    expect(output).toContain('min-w-0 truncate');
    expect(output).toContain('<p');
    expect(output).toContain('Manage your project configuration.');
    expect(output).toContain('font-sans font-medium tracking-normal text-neutral4');
    expect(output).toContain('<button type="button">Save</button>');
    expect(output).toContain('data-slot="settings-layout-content"');
    expect(output).toContain('General settings');
  });

  it('renders header-only content without a second layout container', () => {
    const output = renderToStaticMarkup(
      <SettingsLayout title="Deployment" variant="header">
        <section>Deployment content</section>
      </SettingsLayout>,
    );

    expect(output).toContain('data-slot="settings-page-header"');
    expect(output).not.toContain('data-slot="settings-layout-content"');
    expect(output).toContain('<section>Deployment content</section>');
  });

  it('renders bare content when a header-only layout has no title', () => {
    const output = renderToStaticMarkup(
      <SettingsLayout variant="header">
        <section>Deployment content</section>
      </SettingsLayout>,
    );

    expect(output).not.toContain('data-slot="settings-page-header"');
    expect(output).not.toContain('data-slot="settings-layout-content"');
    expect(output).toBe('<section>Deployment content</section>');
  });

  it('insets the page title when requested', () => {
    const output = renderToStaticMarkup(
      <SettingsLayout title="Project Settings" inset>
        <section>General settings</section>
      </SettingsLayout>,
    );

    expect(output).toContain('pl-4');
  });

  it.each([undefined, null])('supports content with its own page header when title is %s', title => {
    const output = renderToStaticMarkup(
      <SettingsLayout title={title}>
        <h1>Usage</h1>
        <section>Usage settings</section>
      </SettingsLayout>,
    );

    expect(output).not.toContain('data-slot="settings-page-header"');
    expect(output).toContain('<h1>Usage</h1>');
    expect(output).toContain('data-slot="settings-layout-content"');
    expect(output).toContain('Usage settings');
  });
});
