// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  injectGuestHtml,
  installMcpAppSandboxLock,
  MCP_APP_GUEST_SANDBOX,
  sandboxAttributeForProxy,
  sandboxProxyHtml,
} from '../mcp-app-sandbox';

const HOST = 'https://studio.example';
const FORGED_HTML = '<!DOCTYPE html><html><head></head><body><script>parent.document</script></body></html>';

describe('MCP app sandbox', () => {
  it('drops allow-same-origin for a same-origin blob and keeps it for a separate origin', () => {
    const libraryDefault = 'allow-scripts allow-same-origin allow-forms allow-top-navigation';

    expect(sandboxAttributeForProxy(libraryDefault, 'blob:https://studio.example/id', HOST)).toBe(
      'allow-scripts allow-forms',
    );
    expect(sandboxAttributeForProxy(libraryDefault, `${HOST}/sandbox.html`, HOST)).toBe('allow-scripts allow-forms');
    expect(sandboxAttributeForProxy(libraryDefault, 'https://sandbox.example/proxy.html', HOST)).toBe(
      'allow-scripts allow-same-origin allow-forms',
    );
  });

  it('puts the guest behind a fixed sandbox and a CSP that cannot call Studio', () => {
    const html = injectGuestHtml(
      FORGED_HTML,
      {
        connectDomains: [HOST, 'https://api.example.com', 'javascript:alert(1)', 'http://10.0.0.8'],
        frameDomains: [HOST],
      },
      HOST,
    );

    expect(html).toContain('https://api.example.com');
    expect(html).not.toContain(HOST);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('10.0.0.8');
    expect(html).toContain('connect-src https://api.example.com');
    expect(html).toContain("frame-src 'none'");
    expect(html).toContain("object-src 'none'");
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script>'));
    expect(injectGuestHtml('<p>hi</p>', undefined, HOST)).toContain("connect-src 'none'");
  });

  it('lets a declared app resource domain load scripts and styles', () => {
    const html = injectGuestHtml(
      '<html><head></head><body></body></html>',
      {
        resourceDomains: ['https://cdn.jsdelivr.net', HOST],
      },
      HOST,
    );

    expect(html).toMatch(/script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
    expect(html).toMatch(/style-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
    expect(html).not.toContain(HOST);
  });

  it('serves a proxy that does not write guest HTML into the Studio document', () => {
    const proxy = sandboxProxyHtml(HOST);

    expect(proxy).toContain(MCP_APP_GUEST_SANDBOX);
    expect(proxy).toContain("setAttribute('sandbox', GUEST_SANDBOX)");
    expect(proxy).not.toContain('allow-same-origin');
    expect(proxy).not.toContain('document.write');
    expect(proxy).not.toContain('document.open');
    expect(proxy).not.toContain('__name');
    expect(proxy).toContain(HOST);
  });

  it('applies the sandbox attribute before a same-origin blob frame navigates', () => {
    const restore = installMcpAppSandboxLock(HOST);
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-top-navigation');
    frame.src = 'blob:https://studio.example/05310fc3-ae71-4d00-a86b-c54b2eefeb10';

    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    restore();
  });
});
