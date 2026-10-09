import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';

import { StagehandBrowser } from '@mastra/stagehand';
import { launch, type LaunchedChrome } from 'chrome-launcher';

import { SOURCE_LIMITS, TIMING } from '../config';
import {
  assertRobotsAllowed,
  fetchPublicPage,
  type AcquiredPage,
  type DnsResolver,
  type PinnedTransport,
} from './acquisition';

type CdpMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

export type BrowserRenderOptions = {
  resolver?: DnsResolver;
  transport?: PinnedTransport;
  abortSignal?: AbortSignal;
};

class CdpClient {
  #nextId = 1;
  #eventError: Error | undefined;
  #pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  #listeners: Array<(message: CdpMessage) => void | Promise<void>> = [];

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id === undefined) {
        this.#listeners.forEach(listener => {
          void Promise.resolve(listener(message)).catch(error => {
            this.#eventError = error instanceof Error ? error : new Error('BROWSER_CDP_EVENT_FAILED');
          });
        });
        return;
      }
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'BROWSER_CDP_ERROR'));
      else pending.resolve(message.result ?? {});
    });
    socket.addEventListener('close', () => {
      this.#pending.forEach(({ reject }) => reject(new Error('BROWSER_CDP_CLOSED')));
      this.#pending.clear();
    });
  }

  static async open(url: string) {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error('BROWSER_CDP_CONNECT_FAILED')), { once: true });
    });
    return new CdpClient(socket);
  }

  send(method: string, params: Record<string, unknown> = {}) {
    this.throwIfEventFailed();
    const id = this.#nextId++;
    const response = new Promise<Record<string, unknown>>((resolve, reject) =>
      this.#pending.set(id, { resolve, reject }),
    );
    this.socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  onEvent(listener: (message: CdpMessage) => void | Promise<void>) {
    this.#listeners.push(listener);
  }

  throwIfEventFailed() {
    if (this.#eventError) throw this.#eventError;
  }

  close() {
    this.socket.close();
  }
}

function cspHeader() {
  return [
    "default-src 'none'",
    'sandbox allow-scripts',
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'none'",
    "img-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "media-src 'none'",
    "font-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

function browserFlags(proxyPort: number) {
  return [
    '--headless=new',
    `--proxy-server=http://127.0.0.1:${proxyPort}`,
    '--proxy-bypass-list=<-loopback>',
    '--host-resolver-rules=MAP * ~NOTFOUND',
    '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--no-first-run',
    '--no-default-browser-check',
  ];
}

async function pageDebuggerUrl(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = (await response.json()) as { webSocketDebuggerUrl?: string };
  if (!target.webSocketDebuggerUrl) throw new Error('BROWSER_CDP_TARGET_MISSING');
  return target.webSocketDebuggerUrl;
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal, error: () => Error) {
  if (signal.aborted) return Promise.reject(error());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(error());
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      reason => {
        signal.removeEventListener('abort', onAbort);
        reject(reason);
      },
    );
  });
}

function waitForEvent(client: CdpClient, method: string) {
  return new Promise<void>(resolve => {
    client.onEvent(message => {
      if (message.method === method) resolve();
    });
  });
}

function sameDocumentUrl(candidate: string, initial: URL) {
  try {
    const url = new URL(candidate);
    return url.origin === initial.origin && url.pathname === initial.pathname && url.search === initial.search;
  } catch {
    return false;
  }
}

async function killChrome(chrome: LaunchedChrome | undefined) {
  if (!chrome || chrome.process.exitCode !== null) return;
  const exited = Promise.race([
    once(chrome.process, 'exit'),
    new Promise(resolve => setTimeout(resolve, TIMING.browserCleanupMs)),
  ]);
  chrome.kill();
  await exited;
}

async function closeStagehand(stagehand: StagehandBrowser | undefined) {
  if (!stagehand) return;
  // Stagehand awaits its remote CDP manager with no deadline. Continue to kill Chrome if that connection is stalled.
  await Promise.race([
    stagehand.close().catch(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, TIMING.browserCleanupMs)),
  ]);
}

/**
 * Renders a public page in a fresh local Chrome profile. Its only browser egress is a denying loopback proxy;
 * document resources are instead fulfilled from the existing public-IP-pinned Node transport.
 */
export async function renderPublicPage(initial: AcquiredPage, options: BrowserRenderOptions = {}) {
  const startedAt = Date.now();
  let timedOut = false;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.abortSignal?.aborted) abort();
  else options.abortSignal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMING.browserAttemptMs);
  const aborted = () => new Error(timedOut ? 'BROWSER_TIMEOUT' : 'ACQUISITION_CANCELED');
  const initialUrl = new URL(initial.url);
  let bytes = 0;
  let resources = 0;
  let resourceFetches = Promise.resolve();
  let resourceLimitError: Error | undefined;
  const limitResources = () => (resourceLimitError ??= new Error('BROWSER_RESOURCE_LIMIT'));
  const fetchNextResource = (resourceUrl: URL, isDocument: boolean) => {
    const operation = async () => {
      if (resourceLimitError) throw resourceLimitError;
      resources += 1;
      if (resources > SOURCE_LIMITS.maxBrowserResources) throw limitResources();
      const resource =
        resourceUrl.href === initial.url
          ? initial
          : await fetchPublicPage(resourceUrl.href, {
              ...options,
              abortSignal: controller.signal,
              acceptedContentTypes:
                /^(?:text\/html|application\/xhtml\+xml|(?:text|application)\/(?:javascript|ecmascript))$/i,
              ...(isDocument
                ? {
                    beforeRequest: (url: URL) =>
                      assertRobotsAllowed(url.href, { ...options, abortSignal: controller.signal }),
                  }
                : {}),
            });
      const resourceBytes = Buffer.byteLength(resource.html);
      if (bytes + resourceBytes > SOURCE_LIMITS.maxHtmlBytes) throw limitResources();
      bytes += resourceBytes;
      return resource;
    };
    const next = resourceFetches.then(operation);
    resourceFetches = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
  const proxy = createServer((_request, response) => response.writeHead(502).end());
  const proxySockets = new Set<Socket>();
  proxy.on('connection', socket => {
    proxySockets.add(socket);
    socket.once('close', () => proxySockets.delete(socket));
  });
  proxy.on('connect', (_request, socket) => socket.destroy());
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>(resolve => proxy.close(() => resolve()));
    clearTimeout(timeout);
    options.abortSignal?.removeEventListener('abort', abort);
    throw new Error('BROWSER_PROXY_START_FAILED');
  }
  let chrome: LaunchedChrome | undefined;
  let cdp: CdpClient | undefined;
  let stagehand: StagehandBrowser | undefined;
  let mainFrameId: string | undefined;
  try {
    try {
      const launchingChrome = launch({
        chromeFlags: browserFlags(address.port),
        logLevel: 'silent',
        // Fail an unavailable executable promptly while retaining most of the 30-second attempt for Chrome startup.
        connectionPollInterval: TIMING.browserLauncherPollMs,
        maxConnectionRetries: TIMING.browserLauncherMaxRetries,
        prefs: { webrtc: { ip_handling_policy: 'disable_non_proxied_udp' } },
      });
      // An abort can win the race before chrome-launcher resolves. Ensure that late process is not orphaned.
      void launchingChrome
        .then(lateChrome => {
          if (controller.signal.aborted) lateChrome.kill();
        })
        .catch(() => undefined);
      chrome = await abortable(launchingChrome, controller.signal, aborted);
    } catch {
      if (controller.signal.aborted) throw aborted();
      throw new Error('BROWSER_UNAVAILABLE');
    }
    cdp = await abortable(CdpClient.open(await pageDebuggerUrl(chrome.port)), controller.signal, aborted);
    await abortable(cdp.send('Page.enable'), controller.signal, aborted);
    const frameTree = await abortable(cdp.send('Page.getFrameTree'), controller.signal, aborted);
    const rootFrame = frameTree.frameTree as { frame?: { id?: string } } | undefined;
    mainFrameId = rootFrame?.frame?.id;
    await abortable(
      cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }),
      controller.signal,
      aborted,
    );
    await abortable(cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }), controller.signal, aborted);
    cdp.onEvent(async message => {
      if (message.method !== 'Fetch.requestPaused') return;
      const requestId = String(message.params?.requestId);
      const request = message.params?.request as { method?: string; url?: string } | undefined;
      let resourceUrl: URL;
      try {
        resourceUrl = new URL(request?.url ?? '');
      } catch {
        await cdp!.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        return;
      }
      const isTopLevelDocument = message.params?.resourceType === 'Document' && message.params?.frameId === mainFrameId;
      if (isTopLevelDocument && resourceUrl.href !== initial.url) {
        await cdp!.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        throw new Error('BROWSER_PROHIBITED_NAVIGATION');
      }
      if (request?.method !== 'GET' || resourceUrl.origin !== initialUrl.origin || controller.signal.aborted) {
        await cdp!.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        if (isTopLevelDocument) {
          throw new Error('BROWSER_PROHIBITED_NAVIGATION');
        }
        return;
      }
      try {
        const resource = await fetchNextResource(resourceUrl, message.params?.resourceType === 'Document');
        await cdp!.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: resource.status,
          responseHeaders: [
            {
              name: 'Content-Type',
              value: `${resource.contentType}; charset=utf-8`,
            },
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Content-Security-Policy', value: cspHeader() },
          ],
          body: Buffer.from(resource.html).toString('base64'),
        });
      } catch (error) {
        await cdp!.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
        if (error instanceof Error && error.message === 'BROWSER_RESOURCE_LIMIT') throw error;
      }
    });
    const loaded = waitForEvent(cdp, 'Page.loadEventFired');
    await abortable(cdp.send('Page.navigate', { url: initial.url }), controller.signal, aborted);
    await abortable(loaded, controller.signal, aborted);
    stagehand = new StagehandBrowser({ cdpUrl: `http://127.0.0.1:${chrome.port}`, disableAPI: true, selfHeal: false });
    await abortable(stagehand.ensureReady(), controller.signal, aborted);
    const pages = (await stagehand.getManagerForThread())?.context?.pages() ?? [];
    cdp.throwIfEventFailed();
    const page = pages.find(candidate => sameDocumentUrl(candidate.url(), initialUrl));
    if (!page) throw new Error('STAGEHAND_PAGE_MISSING');
    const pageFrameTree = await abortable(
      page.sendCDP<{ frameTree: { frame?: { id?: string } } }>('Page.getFrameTree'),
      controller.signal,
      aborted,
    );
    const frameId = pageFrameTree.frameTree.frame?.id;
    if (!frameId) throw new Error('BROWSER_FRAME_MISSING');
    const isolatedWorld = await abortable(
      page.sendCDP<{ executionContextId?: number }>('Page.createIsolatedWorld', {
        frameId,
        worldName: 'competitor-monitor-boundary',
      }),
      controller.signal,
      aborted,
    );
    if (!isolatedWorld.executionContextId) throw new Error('BROWSER_ISOLATED_WORLD_MISSING');
    const result = await abortable(
      page.sendCDP<{ result: { value?: { html?: string; tooLarge?: boolean } } }>('Runtime.evaluate', {
        expression: `(() => {
          const html = document.documentElement.outerHTML;
          return new TextEncoder().encode(html).byteLength > ${SOURCE_LIMITS.maxHtmlBytes} ? { tooLarge: true } : { html };
        })()`,
        contextId: isolatedWorld.executionContextId,
        returnByValue: true,
      }),
      controller.signal,
      aborted,
    );
    cdp.throwIfEventFailed();
    if (result.result.value?.tooLarge) throw new Error('BROWSER_RENDERED_HTML_LIMIT');
    const html = result.result.value?.html;
    if (!html) throw new Error('BROWSER_EMPTY_DOCUMENT');
    if (Buffer.byteLength(html) > SOURCE_LIMITS.maxHtmlBytes) throw new Error('BROWSER_RENDERED_HTML_LIMIT');
    return {
      html,
      url: initial.url,
      status: initial.status,
      contentType: initial.contentType,
      retries: initial.retries,
      durationMs: initial.durationMs + Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
    options.abortSignal?.removeEventListener('abort', abort);
    await closeStagehand(stagehand);
    cdp?.close();
    await killChrome(chrome);
    proxySockets.forEach(socket => socket.destroy());
    await new Promise<void>(resolve => proxy.close(() => resolve()));
  }
}
