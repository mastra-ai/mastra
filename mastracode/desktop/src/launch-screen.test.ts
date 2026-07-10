import { describe, expect, it } from 'vitest';

import { createLaunchScreenDataUrl, LAUNCH_SCREEN_ACCESSIBLE_NAME } from './launch-screen.js';

function decodeDataUrl(dataUrl: string): string {
  return decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
}

describe('createLaunchScreenDataUrl', () => {
  it('creates an accessible, transparent launch HUD with reduced-motion support', () => {
    const dataUrl = createLaunchScreenDataUrl('data:image/png;base64,AAAA');
    const html = decodeDataUrl(dataUrl);

    expect(dataUrl).toMatch(/^data:text\/html;charset=UTF-8,/);
    expect(html).toContain(`aria-label="${LAUNCH_SCREEN_ACCESSIBLE_NAME}"`);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('background: transparent');
    expect(html).toContain('@media (prefers-reduced-motion: reduce)');
    expect(html).not.toContain('Starting local workspace');
    expect(html).not.toContain('class="brand"');
  });

  it('rejects a launch icon that could load external content', () => {
    expect(() => createLaunchScreenDataUrl('https://example.com/icon.png')).toThrow(
      'MastraCode launch screen requires an embedded image',
    );
  });
});
