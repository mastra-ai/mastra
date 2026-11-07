import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsLayout } from './settings-layout';

describe('SettingsLayout', () => {
  it('renders the page title, accessory, action, and sections', () => {
    const output = renderToStaticMarkup(
      <SettingsLayout
        title="Project settings"
        titleAccessory={<span>Studio</span>}
        action={<button type="button">Save</button>}
      >
        <section>General settings</section>
      </SettingsLayout>,
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
      <SettingsLayout>
        <section>General settings</section>
      </SettingsLayout>,
    );

    expect(output).not.toContain('<h1');
    expect(output).toContain('General settings');
  });
});
