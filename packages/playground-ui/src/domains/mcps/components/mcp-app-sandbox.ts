/**
 * Studio loads third-party MCP App HTML in an iframe. `@mcp-ui/client` always sets
 * `allow-scripts allow-same-origin allow-forms` on that iframe. A same-origin blob
 * proxy plus `allow-same-origin` gives the app the Studio origin, so it can read the
 * parent page and call Studio APIs with the viewer's cookies.
 *
 * The guest document therefore lives in an inner frame whose sandbox never includes
 * `allow-same-origin`. The outer proxy only relays postMessage. A same-origin or blob
 * outer frame also has `allow-same-origin` removed, so the proxy script itself is an
 * opaque origin. Server-supplied `params.sandbox` is ignored.
 */

export const MCP_APP_GUEST_SANDBOX = 'allow-scripts allow-forms';

const ALWAYS_BLOCKED_SANDBOX_TOKENS = new Set([
  'allow-top-navigation',
  'allow-top-navigation-by-user-activation',
  'allow-popups-to-escape-sandbox',
]);

export interface McpAppResourceCsp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  baseUriDomains?: string[];
}

export function isCrossOriginSandboxUrl(sandboxUrl: string, pageOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(sandboxUrl, pageOrigin);
  } catch {
    return false;
  }
  if (url.protocol === 'blob:' || url.protocol === 'data:' || url.protocol === 'about:') return false;
  if (url.origin === 'null') return false;
  return url.origin !== pageOrigin;
}

/** Sandbox tokens for the outer proxy iframe. Same-origin and blob URLs cannot keep `allow-same-origin`. */
export function sandboxAttributeForProxy(requested: string, sandboxUrl: string, pageOrigin: string): string {
  const crossOrigin = sandboxUrl ? isCrossOriginSandboxUrl(sandboxUrl, pageOrigin) : false;
  const tokens = requested.split(/\s+/).filter(token => {
    if (!token || ALWAYS_BLOCKED_SANDBOX_TOKENS.has(token)) return false;
    if (token === 'allow-same-origin' && !crossOrigin) return false;
    return true;
  });
  if (!tokens.includes('allow-scripts')) tokens.unshift('allow-scripts');
  return tokens.join(' ');
}

// A string, not a function, so the bundler cannot inject helpers the iframe does not have.
const INJECT_GUEST_HTML = `function injectGuestHtml(html, csp, hostOrigin) {
  function sources(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (typeof entry !== 'string') continue;
      var trimmed = entry.trim();
      if (!trimmed || /[\\s;,]/.test(trimmed)) continue;
      var url;
      try { url = new URL(trimmed); } catch (error) { continue; }
      if (url.origin === 'null' || url.origin === hostOrigin) continue;
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') continue;
      if (out.indexOf(url.origin) === -1) out.push(url.origin);
    }
    return out;
  }
  var connect = sources(csp && csp.connectDomains);
  var resources = sources(csp && csp.resourceDomains);
  var frames = sources(csp && csp.frameDomains);
  var bases = sources(csp && csp.baseUriDomains);
  var resourceSrc = ['data:', 'blob:', 'https:'].concat(resources).join(' ');
  var policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' blob: data:",
    "style-src 'unsafe-inline'",
    'img-src ' + resourceSrc,
    'font-src ' + resourceSrc,
    'media-src ' + resourceSrc,
    'connect-src ' + (connect.length ? connect.join(' ') : "'none'"),
    'frame-src ' + (frames.length ? frames.join(' ') : "'none'"),
    'base-uri ' + (bases.length ? bases.join(' ') : "'none'"),
    "form-action 'none'",
    "object-src 'none'"
  ].join('; ');
  var meta = '<meta http-equiv="Content-Security-Policy" content="' + policy.replace(/"/g, '&quot;') + '">';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, function (match) { return match + meta; });
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, function (match) { return match + '<head>' + meta + '</head>'; });
  return '<!DOCTYPE html><html><head>' + meta + '</head><body>' + html + '</body></html>';
}`;

/**
 * CSP for the guest document. `connect-src` never includes the Studio origin, so the app
 * cannot call Studio with the viewer's cookies even if a resource asks for that domain.
 * Inline scripts stay allowed because an MCP App is one self-contained HTML document.
 */
export function injectGuestHtml(html: string, csp: McpAppResourceCsp | undefined, hostOrigin: string): string {
  const inject = new Function(`return (${INJECT_GUEST_HTML})`)() as (
    html: string,
    csp: McpAppResourceCsp | undefined,
    hostOrigin: string,
  ) => string;
  return inject(html, csp, hostOrigin);
}

/** Outer proxy document. Relays postMessage and never writes guest HTML into itself. */
export function sandboxProxyHtml(hostOrigin: string): string {
  const host = JSON.stringify(hostOrigin);
  const guestSandbox = JSON.stringify(MCP_APP_GUEST_SANDBOX);
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style></head>
<body><script>
(function(){
  var HOST = ${host};
  var GUEST_SANDBOX = ${guestSandbox};
  var injectGuestHtml = ${INJECT_GUEST_HTML};
  var frame = null;
  var accepted = false;
  var queue = [];
  function relay(data){
    if (!frame || frame.getAttribute('data-ready') !== '1' || !frame.contentWindow) {
      queue.push(data);
      return;
    }
    frame.contentWindow.postMessage(data, '*');
  }
  window.addEventListener('message', function(event){
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (event.source === window.parent) {
      if (event.origin !== HOST) return;
      if (data.method === 'ui/notifications/sandbox-resource-ready') {
        if (accepted) return;
        var params = data.params || {};
        if (typeof params.html !== 'string') return;
        accepted = true;
        frame = document.createElement('iframe');
        frame.setAttribute('sandbox', GUEST_SANDBOX);
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.style.cssText = 'width:100%;height:100%;border:none;background:transparent';
        frame.addEventListener('load', function(){
          if (!frame.getAttribute('srcdoc')) return;
          frame.setAttribute('data-ready', '1');
          var pending = queue.splice(0, queue.length);
          for (var i = 0; i < pending.length; i++) frame.contentWindow.postMessage(pending[i], '*');
        });
        frame.srcdoc = injectGuestHtml(params.html, params.csp, HOST);
        document.body.appendChild(frame);
        return;
      }
      relay(data);
      return;
    }
    if (frame && frame.contentWindow && event.source === frame.contentWindow) {
      window.parent.postMessage(data, HOST);
    }
  });
  window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/sandbox-proxy-ready',params:{}}, HOST);
})();
<\/script></body></html>`;
}

let sandboxLockInstalled = false;

/**
 * `@mcp-ui/client` hardcodes the outer iframe sandbox and ignores `sandbox.permissions`.
 * Rewrite that attribute before the frame navigates.
 */
export function installMcpAppSandboxLock(pageOrigin?: string): () => void {
  if (sandboxLockInstalled || typeof document === 'undefined') return () => {};
  sandboxLockInstalled = true;
  const origin = pageOrigin ?? window.location.origin;
  const originalCreate = document.createElement.bind(document);

  document.createElement = (tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreate(tagName, options);
    if (String(tagName).toLowerCase() === 'iframe' && element instanceof HTMLIFrameElement) {
      lockIframeSandbox(element, origin);
    }
    return element;
  };

  return () => {
    document.createElement = originalCreate;
    sandboxLockInstalled = false;
  };
}

function lockIframeSandbox(frame: HTMLIFrameElement, pageOrigin: string) {
  let requested = '';
  const originalSetAttribute = frame.setAttribute.bind(frame);
  frame.setAttribute = (name: string, value: string) => {
    if (name === 'sandbox') {
      requested = value;
      const src = frame.getAttribute('src') ?? '';
      value = sandboxAttributeForProxy(value, src, pageOrigin);
    } else if (name === 'src' && requested) {
      originalSetAttribute('sandbox', sandboxAttributeForProxy(requested, value, pageOrigin));
    }
    originalSetAttribute(name, value);
  };

  const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  const getSrc = descriptor?.get;
  const setSrc = descriptor?.set;
  if (!getSrc || !setSrc) return;
  Object.defineProperty(frame, 'src', {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    get() {
      return getSrc.call(frame);
    },
    set(value: string) {
      if (requested) originalSetAttribute('sandbox', sandboxAttributeForProxy(requested, String(value), pageOrigin));
      setSrc.call(frame, value);
    },
  });
}
