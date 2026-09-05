import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsLayout } from './settings-layout';

describe('SettingsLayout', () => {
  it('renders the page title, action, and settings content', () => {
    const output = renderToStaticMarkup(
      <SettingsLayout title="Project Settings" action={<button type="button">Save</button>}>
        <section>General settings</section>
      </SettingsLayout>,
    );

    expect(output).toContain('<h1');
    expect(output).toContain('Project Settings');
    expect(output).toContain('data-slot="settings-page-header"');
    expect(output).toContain('flex min-w-0 flex-wrap items-center justify-between gap-4');
    expect(output).not.toContain('pl-4');
    expect(output).toContain('min-w-0 truncate');
    expect(output).toContain('font-sans font-medium tracking-normal text-neutral4');
    expect(output).toContain('<button type="button">Save</button>');
    expect(output).toContain('data-slot="settings-layout-content"');
    expect(output).toContain('General settings');
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
