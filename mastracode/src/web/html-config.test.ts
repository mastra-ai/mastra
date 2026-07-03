import { describe, expect, it } from 'vitest';

import { injectRuntimeConfig } from './html-config';

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MastraCode — Web</title>
    <script>/* theme bootstrap */</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
`;

describe('injectRuntimeConfig', () => {
  describe('given the server knows web auth is enabled', () => {
    it('injects window.__MASTRACODE_CONFIG__ with authEnabled: true right after <head>', () => {
      const out = injectRuntimeConfig(HTML, { authEnabled: true });

      expect(out).toContain('window.__MASTRACODE_CONFIG__ = {"authEnabled":true}');
      // Injected before the theme bootstrap script so it is the first thing in <head>.
      expect(out.indexOf('__MASTRACODE_CONFIG__')).toBeLessThan(out.indexOf('/* theme bootstrap */'));
    });
  });

  describe('given the server knows web auth is disabled', () => {
    it('injects authEnabled: false', () => {
      const out = injectRuntimeConfig(HTML, { authEnabled: false });

      expect(out).toContain('window.__MASTRACODE_CONFIG__ = {"authEnabled":false}');
    });
  });

  it('preserves the original markup', () => {
    const out = injectRuntimeConfig(HTML, { authEnabled: true });

    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('<script type="module" src="/main.tsx"></script>');
    expect(out).toContain('<meta charset="UTF-8" />');
  });

  it('appends the script when no <head> tag exists (degenerate HTML)', () => {
    const out = injectRuntimeConfig('<html><body></body></html>', { authEnabled: false });

    expect(out).toContain('window.__MASTRACODE_CONFIG__ = {"authEnabled":false}');
    expect(out).toContain('<body></body>');
  });
});
