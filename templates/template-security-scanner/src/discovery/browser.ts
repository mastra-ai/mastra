import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import type { Duplex } from 'node:stream';
import { z } from 'zod';
import { parseBrowserSandboxStatus } from '../runtime/browser.js';
import { RuntimeDiagnostic } from '../config/settings.js';
import type { PrivateSandbox } from './native.js';
import type { SecretGuard } from './parser.js';
import { corsReadObservation } from './cors-observation.js';

const unsafeFlags = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-seccomp-filter-sandbox',
  '--disable-namespace-sandbox',
  '--disable-web-security',
  '--allow-running-insecure-content',
  '--allow-insecure-localhost',
  '--ignore-certificate-errors',
  '--ignore-certificate-errors-spki-list',
  '--remote-allow-origins',
];
export class BrowserInspectionError extends Error {
  constructor(
    readonly stage:
      | 'BROWSER_ARGS_FAILED'
      | 'BROWSER_ARGS_TRUNCATED'
      | 'BROWSER_ARGS_SECRET'
      | 'BROWSER_FLAGS'
      | 'BROWSER_CONTROL',
  ) {
    super(stage);
  }
}
/** Inspect Chromium readiness and report the observed browser sandbox controls. */
export async function inspectBrowser(sandbox: PrivateSandbox, guard: SecretGuard, signal: AbortSignal) {
  const result = await sandbox.executeCommand('/bin/sh', ['/workspace/browser-inspect.sh'], {
    timeout: 3000,
    maxRetainedBytes: 16384,
    abortSignal: signal,
  });
  if (!result.success) throw new BrowserInspectionError('BROWSER_ARGS_FAILED');
  if (result.stdoutTruncated || result.stderrTruncated) throw new BrowserInspectionError('BROWSER_ARGS_TRUNCATED');
  if (guard.unsafe(result.stdout)) throw new BrowserInspectionError('BROWSER_ARGS_SECRET');
  const processes = result.stdout
    .split('PROCESS\0')
    .slice(1)
    .map(value => value.split('\0').filter(Boolean));
  // Crashpad lives in the same directory but is not a browser root and does
  // not accept proxy/CDP flags. Inspect executable basenames, not directory names.
  /** Recognize the supported Chromium executable basenames. */
  const isBrowser = (executable: string | undefined) =>
    Boolean(executable && /(?:^|\/)(?:chromium|chrome|chrome-headless-shell)$/.test(executable));
  const roots = processes.filter(args => isBrowser(args[0]) && !args.some(arg => arg.startsWith('--type=')));
  const browsers = processes.filter(args => isBrowser(args[0]));
  const ports = processes
    .filter(args => args[0]?.endsWith('/leakless'))
    .map(args => Number(args[2]?.replace('127.0.0.1:', '')));
  if (
    ports.some(port => !Number.isInteger(port) || port < 40000 || port > 40031) ||
    browsers.some(args => args.some(arg => unsafeFlags.some(flag => arg === flag || arg.startsWith(`${flag}=`))))
  )
    throw new BrowserInspectionError('BROWSER_FLAGS');
  for (const args of roots)
    if (
      !args.includes('--remote-debugging-address=127.0.0.1') ||
      !args.includes('--remote-debugging-port=9222') ||
      !args.includes('--proxy-bypass-list=<-loopback>') ||
      !args.some(arg => arg.startsWith('--proxy-server='))
    )
      throw new BrowserInspectionError('BROWSER_CONTROL');
  return { browserProcesses: browsers.length, roots: roots.length, bootstrapPorts: ports };
}
const record = (value: unknown): Record<string, unknown> => z.record(z.string(), z.unknown()).parse(value);

// Fixed CDP operations against the current owned browser only. nc transports
// the loopback socket over public Docker exec stdin/stdout; no port publication,
// host namespace, target-page evaluation, or generic CDP API is exposed.
type BrowserObserver = (message: Record<string, unknown>) => void;
type BrowserDrain = (observe: BrowserObserver, done: () => boolean) => Promise<void>;
type BrowserCall = (
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
  observe?: BrowserObserver,
) => Promise<Record<string, unknown>>;
/** Open an isolated browser page and drain its command process during teardown. */
async function withBrowserPage<T>(
  sandbox: PrivateSandbox,
  signal: AbortSignal,
  url: string,
  inspect: (call: BrowserCall, session: string, drain: BrowserDrain) => Promise<T>,
  setStage: (stage: 'BROWSER_VERSION' | 'BROWSER_WEBSOCKET' | 'BROWSER_TARGET' | 'BROWSER_STATUS') => void = () => {},
) {
  setStage('BROWSER_VERSION');
  let version = await sandbox.executeCommand('wget', ['-q', '-O', '-', 'http://127.0.0.1:9222/json/version'], {
    timeout: 2000,
    maxRetainedBytes: 8192,
    abortSignal: signal,
  });
  // A /proc browser root can appear before its loopback control listener.
  // Wait only for startup readiness; every eventual policy/status check remains mandatory.
  for (let attempt = 0; !version.success && attempt < 4; attempt++) {
    await pause(100, undefined, { signal });
    version = await sandbox.executeCommand('wget', ['-q', '-O', '-', 'http://127.0.0.1:9222/json/version'], {
      timeout: 2000,
      maxRetainedBytes: 8192,
      abortSignal: signal,
    });
  }
  if (!version.success || version.stdoutTruncated || version.stderrTruncated)
    throw new Error('BROWSER_CONTROL_VERSION');
  const endpoint = z
    .string()
    .regex(/^ws:\/\/127\.0\.0\.1:9222\/devtools\/browser\/[a-f0-9-]{36}$/)
    .parse(record(JSON.parse(version.stdout)).webSocketDebuggerUrl);
  const path = new URL(endpoint).pathname;
  setStage('BROWSER_WEBSOCKET');
  const execution = await sandbox.container.exec({
    Cmd: ['nc', '127.0.0.1', '9222'],
    User: '10001:10001',
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    abortSignal: signal,
  });
  const stream: Duplex = await execution.start({ hijack: true, stdin: true, abortSignal: signal });
  let ended = false,
    error = false,
    transport = Buffer.alloc(0),
    payload = Buffer.alloc(0),
    received = 0;
  const deadline = Date.now() + 8000;
  stream.on('error', () => {
    error = true;
  });
  stream.on('end', () => {
    ended = true;
  });
  stream.pause();
  /** Fill the private WebSocket buffer to the requested length within cancellation and deadline bounds. */
  const fill = async (length: number) => {
    while (payload.length < length) {
      signal.throwIfAborted();
      if (error || ended || Date.now() >= deadline) throw new Error('BROWSER_CONTROL_STOPPED');
      const incoming: Buffer | null = stream.read();
      if (!incoming) {
        await pause(5, undefined, { signal });
        continue;
      }
      received += incoming.length;
      if (received > 262144) throw new Error('BROWSER_CONTROL_BOUND');
      transport = Buffer.concat([transport, incoming]);
      while (transport.length >= 8) {
        const channel = transport[0],
          size = transport.readUInt32BE(4);
        if (size > 131072 || transport[1] || transport[2] || transport[3] || ![1, 2].includes(channel ?? 0))
          throw new Error('BROWSER_CONTROL_FRAME');
        if (transport.length < 8 + size) break;
        if (channel === 2 && size) throw new Error('BROWSER_CONTROL_FAILED');
        payload = Buffer.concat([payload, transport.subarray(8, 8 + size)]);
        transport = transport.subarray(8 + size);
      }
    }
  };
  const read = async (length: number) => {
    await fill(length);
    const result = payload.subarray(0, length);
    payload = payload.subarray(length);
    return result;
  };
  const write = (value: Buffer | string) =>
    new Promise<void>((resolve, reject) => {
      stream.write(value, (failure?: Error | null) =>
        failure ? reject(new Error('BROWSER_CONTROL_WRITE')) : resolve(),
      );
    });
  const nonce = randomBytes(16).toString('base64');
  /** Send one masked client WebSocket frame containing the serialized browser command. */
  const send = async (value: Record<string, unknown>) => {
    const bytes = Buffer.from(JSON.stringify(value)),
      mask = randomBytes(4);
    if (bytes.length > 65535) throw new Error('BROWSER_CONTROL_COMMAND');
    const header =
      bytes.length < 126
        ? Buffer.from([0x81, 0x80 | bytes.length])
        : Buffer.from([0x81, 0xfe, bytes.length >> 8, bytes.length & 255]);
    const masked = Buffer.from(bytes);
    for (let index = 0; index < masked.length; index++) masked[index] = masked[index]! ^ mask[index % 4]!;
    await write(Buffer.concat([header, mask, masked]));
  };
  /** Read and validate one bounded unmasked text frame from the browser channel. */
  const readMessage = async () => {
    const header = await read(2);
    if (header[0] !== 0x81 || header[1] === undefined || header[1] & 0x80) throw new Error('BROWSER_CONTROL_WEBSOCKET');
    let size = header[1] & 127;
    if (size === 126) size = (await read(2)).readUInt16BE();
    else if (size === 127) {
      const large = (await read(8)).readBigUInt64BE();
      if (large > 131072n) throw new Error('BROWSER_CONTROL_BOUND');
      size = Number(large);
    }
    if (size > 131072) throw new Error('BROWSER_CONTROL_BOUND');
    return record(JSON.parse((await read(size)).toString()));
  };
  let id = 0;
  /** Send a browser protocol command and observe channel events until its matching response arrives. */
  const call: BrowserCall = async (method, params, sessionId, observe) => {
    const current = ++id;
    await send({ id: current, method, params, ...(sessionId ? { sessionId } : {}) });
    for (let count = 0; count < 100; count++) {
      const message = await readMessage();
      observe?.(message);
      if (message.id === current) {
        if (message.error) throw new Error('BROWSER_CONTROL_COMMAND');
        return record(message.result);
      }
    }
    throw new Error('BROWSER_CONTROL_EVENTS');
  };
  /** Drain existing browser notifications until the observation is settled or its drain deadline expires. */
  const drain: BrowserDrain = async (observe, done) => {
    // Runtime's promise result can precede native network notifications. Read
    // only this existing channel within its original byte/time/message bounds.
    for (let count = 0; !done(); count++) {
      if (count >= 100) throw new Error('BROWSER_CONTROL_EVENTS');
      observe(await readMessage());
    }
  };
  let targetId: string | undefined;
  try {
    await write(
      `GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${nonce}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
    );
    let upgrade = '';
    while (!upgrade.endsWith('\r\n\r\n')) {
      if (upgrade.length >= 8192) throw new Error('BROWSER_CONTROL_UPGRADE');
      upgrade += (await read(1)).toString('ascii');
    }
    const expected = createHash('sha1')
      .update(nonce + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    if (
      !/^HTTP\/1\.1 101 /.test(upgrade) ||
      !upgrade
        .split('\r\n')
        .some(
          line =>
            line.slice(0, line.indexOf(':')).toLowerCase() === 'sec-websocket-accept' &&
            line.slice(line.indexOf(':') + 1).trim() === expected,
        )
    )
      throw new Error('BROWSER_CONTROL_UPGRADE');
    setStage('BROWSER_TARGET');
    targetId = z
      .string()
      .min(1)
      .max(128)
      .parse((await call('Target.createTarget', { url })).targetId);
    const session = z
      .string()
      .min(1)
      .max(128)
      .parse((await call('Target.attachToTarget', { targetId, flatten: true })).sessionId);
    setStage('BROWSER_STATUS');
    return await inspect(call, session, drain);
  } finally {
    if (targetId) await call('Target.closeTarget', { targetId }).catch(() => undefined);
    stream.destroy();
  }
}

export async function browserSandboxStatus(
  sandbox: PrivateSandbox,
  signal: AbortSignal,
  setStage: (stage: 'BROWSER_VERSION' | 'BROWSER_WEBSOCKET' | 'BROWSER_TARGET' | 'BROWSER_STATUS') => void = () => {},
) {
  return withBrowserPage(
    sandbox,
    signal,
    'chrome://sandbox',
    async (call, session) => {
      for (let attempt = 0; attempt < 15; attempt++) {
        const result = record(
          (
            await call(
              'Runtime.evaluate',
              { expression: 'document.documentElement.outerHTML', returnByValue: true },
              session,
            )
          ).result,
        );
        if (typeof result.value === 'string' && result.value.includes('sandbox-status')) {
          try {
            return { ...parseBrowserSandboxStatus(result.value), readinessAttempts: attempt + 1 };
          } catch (error) {
            if (!(error instanceof RuntimeDiagnostic) || error.code !== 'BROWSER_SANDBOX_UNAVAILABLE') throw error;
            // The built-in page populates rows asynchronously. A partial table
            // is never positive evidence; retry within this existing finite loop.
          }
        }
        await pause(50, undefined, { signal });
      }
      throw new Error('BROWSER_SANDBOX_UNAVAILABLE');
    },
    setStage,
  );
}

// The source document is owned, inert and opaque-origin. Only this fixed fetch
// expression executes; no target HTML or model-supplied program is evaluated.
/** Observe a bounded cross-origin browser read through the confined discovery runtime. */
export async function browserCrossOriginRead(
  sandbox: PrivateSandbox,
  signal: AbortSignal,
  url: string,
  marker: string,
) {
  const destination = z.url().max(2048).parse(url);
  const expected = z
    .string()
    .regex(/^LAB_MARKER_[A-Z0-9]{8,64}$/)
    .parse(marker);
  try {
    return await withBrowserPage(
      sandbox,
      signal,
      'data:text/html,<title>Owned%20CORS%20probe</title>',
      async (call, session, drain) => {
        const observed = corsReadObservation(session, destination);
        await call(
          'Network.enable',
          { maxTotalBufferSize: 8192, maxResourceBufferSize: 8192, maxPostDataSize: 0, enableDurableMessages: false },
          session,
          observed.observe,
        );
        const expression = `(async () => {
      try {
        const response = await fetch(${JSON.stringify(destination)}, {mode:'cors',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(4000)});
        if (!response.body || response.status !== 200) return {completed:false,readable:false};
        const reader = response.body.getReader();
        let total = 0, text = '', decoder = new TextDecoder();
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            total += chunk.value.length;
            if (total > 8192) {await reader.cancel();return {completed:false,readable:false};}
            text += decoder.decode(chunk.value,{stream:true});
          }
          text += decoder.decode();
          return {completed:true,readable:text.includes(${JSON.stringify(expected)})};
        } finally { reader.releaseLock(); }
      } catch { return {completed:false,readable:false}; }
    })()`;
        try {
          const result = record(
            (
              await call(
                'Runtime.evaluate',
                { expression, awaitPromise: true, returnByValue: true },
                session,
                observed.observe,
              )
            ).result,
          );
          await drain(observed.observe, observed.ready);
          const outcome = observed.result(result.value);
          return outcome.state === 'COMPLETED_READ'
            ? { completed: true, readable: outcome.markerMatched }
            : { completed: outcome.state === 'CORS_DENIED', readable: false };
        } finally {
          await call('Network.disable', {}, session).catch(() => undefined);
        }
      },
    );
  } catch {
    signal.throwIfAborted();
    return { completed: false, readable: false };
  }
}
