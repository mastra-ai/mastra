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

  it('keeps wss connect sources and rejects sources that could match Studio', () => {
    const html = injectGuestHtml(
      '<p>hi</p>',
      {
        connectDomains: [
          'wss://realtime.service.com',
          'https://*.example',
          'http://studio.example',
          'ws://studio.example',
        ],
        resourceDomains: ['*', 'https:'],
      },
      HOST,
    );

    expect(html).toContain('connect-src wss://realtime.service.com');
    expect(html).not.toContain('studio.example');
    expect(html).not.toContain('*.example');
    expect(html).toMatch(/img-src data: blob:;/);
  });

  it('does not allow every https origin for images, fonts or media', () => {
    const html = injectGuestHtml('<p>hi</p>', undefined, HOST);

    expect(html).not.toMatch(/(img|font|media)-src[^;]*https:/);
  });

  it('puts the policy in the parsed head even when the markup has a decoy head', () => {
    const html = injectGuestHtml(
      '<!-- <head> --><html><head><title>t</title></head><body><script>fetch("x")</script></body></html>',
      undefined,
      HOST,
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.head.firstElementChild?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script>'));
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

  it('replaces the guest frame when the proxy receives new HTML', () => {
    const script = /<script>([\s\S]*)<\/script>/.exec(sandboxProxyHtml(HOST))?.[1];
    expect(script).toBeTruthy();
    new Function(script ?? '')();
    const send = (html: string) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST,
          source: window,
          data: { jsonrpc: '2.0', method: 'ui/notifications/sandbox-resource-ready', params: { html } },
        }),
      );

    send('<p>first app</p>');
    send('<p>second app</p>');

    const frames = document.body.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.getAttribute('srcdoc')).toContain('second app');
    expect(frames[0]?.getAttribute('srcdoc')).not.toContain('first app');
    frames.forEach(frame => frame.remove());
  });
});
