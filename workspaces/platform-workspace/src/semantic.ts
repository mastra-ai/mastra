import type { SandboxTemplateBuilder } from './template.js';

/**
 * Semantic hands: an accessibility daemon (mastra-cc) inside the computer that finds, reads and acts on
 * UI elements by role and name. Built from a pinned public commit at template-build time.
 */
export const MCC_COMMIT = 'a803c9baa45f3689462d18ec113243dcb75bb74b';
/** sha256 of codeload.github.com/CodingButter/mastra-cc/tar.gz/<MCC_COMMIT>. */
export const MCC_SHA256 = '74b422d985ceac71858e930568674d260aa2f2045915a0ba779ebe4c4e99c81d';
/** Wire-schema digest the daemon built from MCC_COMMIT accepts in `hello` (protocol 1.29.0). */
export const MCC_SCHEMA_DIGEST = '7123f4e95a1d0f5c4226940e344fcce37f87e87538733b8d954b136958ee6b0f';
export const MCC_SCHEMA_VERSION = '1.29.0';
export const DAEMON_PORT = 9979;
export const SEMANTIC_MEMORY_MB = 2048;
const DEST = '/opt/mastra-cc';

export const SEMANTIC_UNAVAILABLE =
  'semantic hands unavailable: the accessibility daemon is not installed on this computer (template still building?) — use the pixel tools';
export const SEMANTIC_LOW_MEMORY =
  'semantic hands unavailable: this computer has under 2 GB of memory — use the pixel tools';
export const SEMANTIC_NO_NETWORK = 'semantic hands need an E2B computer with port previews — use the pixel tools';

/** Template-build step: apps, accessibility stack, and the daemon built from the pinned, checksummed source. */
export const INSTALL_SEMANTIC_SCRIPT = `set -euo pipefail
MCC_COMMIT=${MCC_COMMIT}
MCC_SHA256=${MCC_SHA256}
DEST=${DEST}
if [ -f "$DEST/$MCC_COMMIT" ]; then echo "daemon present"; exit 0; fi
export DEBIAN_FRONTEND=noninteractive
SUDO=; [ "$(id -u)" = 0 ] || SUDO=sudo
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq --no-install-recommends ca-certificates curl at-spi2-core dbus dbus-x11 libatk-adaptor x11-apps kate dolphin konsole chromium >/dev/null
major=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\\1/' || true)
if [ "\${major:-0}" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - >/dev/null
  $SUDO apt-get install -y -qq nodejs >/dev/null
fi
work=$(mktemp -d)
curl -fsSL -o "$work/src.tgz" "https://codeload.github.com/CodingButter/mastra-cc/tar.gz/$MCC_COMMIT"
echo "$MCC_SHA256  $work/src.tgz" | sha256sum -c - >/dev/null || { echo "mastra-cc source checksum mismatch" >&2; exit 1; }
tar -xzf "$work/src.tgz" -C "$work"
cd "$work/mastra-cc-$MCC_COMMIT"
node protocol/generate.mjs >/dev/null
npx -y pnpm@10.23.0 install --frozen-lockfile --ignore-scripts --filter @mastra-cc/daemon... >/dev/null
npx -y pnpm@10.23.0 --filter @mastra-cc/protocol-types run build >/dev/null
npx -y pnpm@10.23.0 --filter @mastra-cc/daemon run build >/dev/null
grep -q '"${MCC_SCHEMA_DIGEST}"' daemon/dist/server-*.mjs || { echo "daemon schema digest mismatch" >&2; exit 1; }
$SUDO rm -rf "$DEST" && $SUDO mkdir -p "$DEST"
$SUDO cp -R daemon/dist "$DEST/dist"
$SUDO touch "$DEST/$MCC_COMMIT"
cd / && rm -rf "$work" "$HOME/.local/share/pnpm" "$HOME/.npm/_npx"
echo "daemon installed"
`;

/**
 * Runs as `bash -c`, so process checks match names or pid files, never command lines (`pgrep -f` would
 * match this script's own text).
 *
 * Boots one session bus, the accessibility layer, the four granted apps and the daemon. Idempotent;
 * restarts only what is down. Grants name the four apps this script starts, bound to their executables;
 * apps started any other way are not drivable.
 */
export const BOOT_SEMANTIC_SCRIPT = `set -uo pipefail
[ -f ${DEST}/${MCC_COMMIT} ] || { echo missing; exit 0; }
mem=$(awk '/MemTotal/{print $2}' /proc/meminfo)
[ "\${mem:-0}" -ge 1900000 ] || { echo lowmem; exit 0; }
mkdir -p /tmp/mcc/xdg && chmod 700 /tmp/mcc/xdg && cd /tmp/mcc
exec 9>/tmp/mcc/.boot.lock; flock 9
up() { (echo >/dev/tcp/127.0.0.1/${DAEMON_PORT}) 2>/dev/null; }
busok() { [ -f bus.env ] && (. ./bus.env && dbus-send --session --dest=org.freedesktop.DBus --print-reply / org.freedesktop.DBus.ListNames >/dev/null 2>&1); }
if busok && up; then echo ready; exit 0; fi
if ! busok; then
  addr=$(dbus-daemon --session --fork --print-address=1 2>/dev/null 9>&- | head -1)
  cat > bus.env <<EOF
export DISPLAY=:1
export DBUS_SESSION_BUS_ADDRESS='$addr'
export QT_LINUX_ACCESSIBILITY_ALWAYS_ON=1
export QT_ACCESSIBILITY=1
export GTK_MODULES=gail:atk-bridge
export NO_AT_BRIDGE=0
export XDG_RUNTIME_DIR=/tmp/mcc/xdg
export QT_QPA_PLATFORM=xcb
EOF
  rm -f grants.json
fi
. ./bus.env
L=""
for c in /usr/libexec/at-spi-bus-launcher /usr/libexec/at-spi2-core/at-spi-bus-launcher /usr/lib/at-spi2-core/at-spi-bus-launcher; do [ -x $c ] && L=$c && break; done
[ -n "$L" ] || { echo "no at-spi-bus-launcher"; exit 1; }
pgrep -x at-spi-bus-laun >/dev/null || { setsid nohup "$L" --launch-immediately --a11y=1 >launcher.log 2>&1 </dev/null 9>&- & }
for _ in $(seq 1 40); do dbus-send --session --print-reply --dest=org.a11y.Bus /org/a11y/bus org.a11y.Bus.GetAddress >/dev/null 2>&1 && break; sleep 0.25; done
for p in IsEnabled ScreenReaderEnabled; do dbus-send --session --dest=org.a11y.Bus /org/a11y/bus org.freedesktop.DBus.Properties.Set string:org.a11y.Status string:$p variant:boolean:true >/dev/null 2>&1 || true; done
[ -f "$HOME/notes.txt" ] || : > "$HOME/notes.txt"
launched=0
start() { name=$1; shift; pgrep -x "$name" >/dev/null || { setsid nohup "$@" >"app-$name.log" 2>&1 </dev/null 9>&- & launched=1; }; }
start kate kate "$HOME/notes.txt"
start dolphin dolphin "$HOME"
start konsole konsole
pgrep -x chromium >/dev/null || { launched=1; setsid nohup chromium --no-sandbox --force-renderer-accessibility --no-first-run --no-default-browser-check --user-data-dir=/tmp/mcc/chrome --window-size=900,560 about:blank >app-chrome.log 2>&1 </dev/null 9>&- & }
# Keyboard input lands in the active window: leave Kate in front once the slower windows have mapped.
if [ "$launched" = 1 ]; then
  for _ in $(seq 1 60); do xdotool search --onlyvisible --class chromium >/dev/null 2>&1 && break; sleep 0.25; done
  sleep 1; xdotool search --onlyvisible --class kate 2>/dev/null | head -1 | xargs -r xdotool windowactivate >/dev/null 2>&1 || true
fi
if [ ! -s grants.json ]; then
  node -e 'const fs=require("fs");const apps=[["kate","/usr/bin/kate"],["dolphin","/usr/bin/dolphin"],["konsole","/usr/bin/konsole"],["Chromium","/usr/lib/chromium/chromium"]];process.stdout.write(JSON.stringify({applications:apps.map(([name,p])=>({name,executable:fs.realpathSync(p)}))}))' > grants.json || { rm -f grants.json; echo "grants failed"; exit 1; }
fi
if ! up; then
  [ -f daemon.pid ] && kill "$(cat daemon.pid)" 2>/dev/null
  setsid nohup node ${DEST}/dist/main.mjs --backend atspi --grants /tmp/mcc/grants.json \\
    --allow edit --allow activate --allow submit --allow rawInput --acquire-accessibility \\
    --audit /tmp/mcc/audit.jsonl --socket /tmp/mcc/daemon.sock --ws-port ${DAEMON_PORT} --ws-host 0.0.0.0 >daemon.log 2>&1 </dev/null 9>&- &
  echo $! > daemon.pid
  for _ in $(seq 1 60); do up && break; sleep 0.25; done
fi
up && echo ready || { echo "daemon not listening"; tail -5 daemon.log; exit 1; }
`;

/** Adds the semantic-hands install step and the memory it needs. */
export function withSemantic(builder: SandboxTemplateBuilder): SandboxTemplateBuilder {
  return builder.runCmd(INSTALL_SEMANTIC_SCRIPT).memoryMB(SEMANTIC_MEMORY_MB);
}

/** The keyboard chords the daemon accepts, aimed at an element. */
export const KEY_CHORDS = [
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'F2',
] as const;

export interface DaemonRefusal {
  class?: string;
  code?: string;
  message?: string;
}

/** A change event reduced to host-known values; nothing the daemon wrote travels further. */
export interface DaemonEvent {
  subscriptionId: string;
  kind: 'appeared' | 'disappeared' | 'changed' | 'watchEnded';
  attribution: 'self' | 'other';
}

/** The slice of a WebSocket the client uses; Node's global `WebSocket` fits. */
export interface DaemonSocket {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type DaemonConnect = (url: string, headers: Record<string, string>) => DaemonSocket;

export const defaultConnect: DaemonConnect = (url, headers) =>
  new (globalThis as any).WebSocket(url, { headers }) as DaemonSocket;

const REQUEST_TIMEOUT_MS = 30_000;
/** Largest unterminated input the client buffers; an element crop of the whole 1024x640 desktop is well under it. */
export const MAX_FRAME_CHARS = 8 * 1024 * 1024;

/**
 * An error whose message the host wrote. Only these reach tool results: anything else (provider, URL,
 * socket errors) may carry the preview url or cookie and is replaced with a fixed message.
 */
export class DaemonError extends Error {}

export const DAEMON_UNREACHABLE = 'could not reach the accessibility daemon';
export const DAEMON_PROTOCOL = 'the accessibility daemon broke the protocol; the connection was closed';

/** The change kinds the daemon reports. Anything else is reported as `changed`. */
export const EVENT_KINDS = ['appeared', 'disappeared', 'changed', 'watchEnded'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Reduces a wire event to host-known values, or undefined when it is not one. */
export function parseEvent(raw: any): DaemonEvent | undefined {
  if (typeof raw?.subscriptionId !== 'string' || raw.subscriptionId.length > 128) return undefined;
  const kind: EventKind = (EVENT_KINDS as readonly string[]).includes(raw.kind) ? raw.kind : 'changed';
  const attribution = raw.attribution === 'self' ? 'self' : 'other';
  return { subscriptionId: raw.subscriptionId, kind, attribution };
}

/**
 * One connection to a computer's daemon. Connects lazily, reconnects on the next call after a drop
 * (fetching a fresh preview url and cookie each time), and closes the socket on a timed-out request so a
 * hung daemon cannot wedge the computer's queue. Watches live and die with the connection. The daemon runs
 * inside a sandbox the agent controls, so everything it sends is bounded and any protocol violation closes
 * the connection.
 */
export class DaemonClient {
  #socket?: DaemonSocket;
  #opening?: Promise<DaemonSocket>;
  #abortOpening?: () => void;
  #next = 1;
  #buffer = '';
  readonly #abandoned = new Set<number>();
  readonly #pending = new Map<number, { resolve: (r: any) => void; reject: (e: Error) => void }>();
  #closed = false;

  constructor(
    private readonly endpoint: () => Promise<{ url: string; headers: Record<string, string> } | null>,
    private readonly handlers: { onEvent(event: DaemonEvent): void; onClose(): void },
    private readonly connect: DaemonConnect = defaultConnect,
  ) {}

  get connected() {
    return this.#socket !== undefined;
  }

  /**
   * Sends one request. On timeout the connection is dropped (the daemon's state is unknown), unless
   * `dropOnTimeout` is false: then only this request is abandoned and its late answer is ignored.
   */
  async request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = REQUEST_TIMEOUT_MS,
    dropOnTimeout = true,
  ): Promise<any> {
    const socket = await this.#open();
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new DaemonError(`the accessibility daemon did not answer ${method} in time`));
        if (dropOnTimeout) this.#drop(socket);
        else if (this.#abandoned.size < 64) this.#abandoned.add(id);
      }, timeoutMs);
      this.#pending.set(id, {
        resolve: r => (clearTimeout(timer), resolve(r)),
        reject: e => (clearTimeout(timer), reject(e)),
      });
      socket.send(JSON.stringify({ type: 'request', id, method, params }) + '\n');
    });
  }

  close() {
    this.#closed = true;
    this.#abortOpening?.();
    if (this.#socket) this.#drop(this.#socket);
  }

  #open(): Promise<DaemonSocket> {
    if (this.#closed) return Promise.reject(new DaemonError('computer destroyed'));
    if (this.#socket) return Promise.resolve(this.#socket);
    this.#opening ??= this.#handshake().finally(() => (this.#opening = undefined));
    return this.#opening;
  }

  async #handshake(): Promise<DaemonSocket> {
    let socket: DaemonSocket;
    try {
      const endpoint = await this.endpoint();
      if (!endpoint) throw new DaemonError(SEMANTIC_NO_NETWORK);
      const url = new URL(endpoint.url);
      url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
      if (this.#closed) throw new DaemonError('computer destroyed');
      socket = this.connect(url.toString(), endpoint.headers);
    } catch (error) {
      throw error instanceof DaemonError ? error : new DaemonError(DAEMON_UNREACHABLE);
    }
    this.#buffer = '';
    return new Promise((resolve, reject) => {
      let hello = false;
      const timer = setTimeout(() => fail('timed out connecting to the accessibility daemon'), REQUEST_TIMEOUT_MS);
      const fail = (message: string) => {
        clearTimeout(timer);
        this.#abortOpening = undefined;
        socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
        try {
          socket.close();
        } catch {}
        reject(new DaemonError(message));
      };
      this.#abortOpening = () => fail('computer destroyed');
      socket.onerror = () => fail(DAEMON_UNREACHABLE);
      socket.onclose = () => fail('the accessibility daemon closed the connection');
      socket.onopen = () => {
        if (this.#closed) return fail('computer destroyed');
        socket.send(JSON.stringify({ type: 'hello', digest: MCC_SCHEMA_DIGEST, version: MCC_SCHEMA_VERSION }) + '\n');
      };
      socket.onmessage = ev => {
        let lines: any[];
        try {
          lines = this.#lines(ev.data);
        } catch {
          return hello ? this.#drop(socket) : fail(DAEMON_PROTOCOL);
        }
        for (const msg of lines) {
          if (!hello) {
            if (this.#closed) return fail('computer destroyed');
            if (msg?.type !== 'hello' || msg.digest !== MCC_SCHEMA_DIGEST) {
              // Fixed text: before the handshake nothing the far end says is passed on.
              return fail('the accessibility daemon refused the handshake (schema mismatch)');
            }
            hello = true;
            clearTimeout(timer);
            this.#abortOpening = undefined;
            this.#socket = socket;
            socket.onerror = () => this.#drop(socket);
            socket.onclose = () => this.#drop(socket);
            resolve(socket);
          } else if (!this.#route(msg)) {
            return this.#drop(socket);
          }
        }
      };
    });
  }

  /** Complete lines from the buffer. Throws on an oversized frame or a line that is not JSON. */
  #lines(data: unknown): any[] {
    const chunk = typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf8');
    this.#buffer += chunk;
    const out: any[] = [];
    let i: number;
    while ((i = this.#buffer.indexOf('\n')) >= 0) {
      const line = this.#buffer.slice(0, i);
      this.#buffer = this.#buffer.slice(i + 1);
      if (line.length > MAX_FRAME_CHARS) throw new Error('oversized');
      if (line.trim()) out.push(JSON.parse(line));
    }
    if (this.#buffer.length > MAX_FRAME_CHARS) throw new Error('oversized');
    return out;
  }

  /** Routes one message; false is a protocol violation. */
  #route(msg: any): boolean {
    if (msg?.type === 'response') {
      const p = this.#pending.get(msg.id);
      if (!p) return this.#abandoned.delete(msg.id);
      this.#pending.delete(msg.id);
      p.resolve(msg.result && typeof msg.result === 'object' ? msg.result : {});
      return true;
    }
    if (msg?.type === 'event') {
      const event = parseEvent(msg.event);
      if (!event) return false;
      this.handlers.onEvent(event);
      return true;
    }
    return false;
  }

  #drop(socket: DaemonSocket) {
    if (this.#socket !== socket) return;
    this.#socket = undefined;
    this.#buffer = '';
    this.#abandoned.clear();
    socket.onclose = socket.onerror = socket.onmessage = null;
    try {
      socket.close();
    } catch {}
    for (const [, p] of this.#pending) p.reject(new DaemonError('the accessibility daemon connection dropped'));
    this.#pending.clear();
    this.handlers.onClose();
  }
}

/** A refusal, verbatim and short, for a tool result. */
export function refusalText(refusal: DaemonRefusal): string {
  const text = `refused (${refusal.code ?? 'unknown'}): ${refusal.message ?? ''}`.trim();
  return text.length > 400 ? `${text.slice(0, 399)}…` : text;
}

const CONTENT_MAX = 200;

const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined);
const strs = (v: unknown, max: number) =>
  Array.isArray(v) ? v.slice(0, 16).flatMap(x => (typeof x === 'string' ? [x.slice(0, max)] : [])) : [];

/** The parts of an element a model needs to pick and act on it, each bounded. */
export function slimElement(el: any) {
  const content = el?.content?.kind === 'text' && typeof el.content.value === 'string' ? el.content.value : undefined;
  const avail = (v: unknown, key: string) =>
    strs(Array.isArray(v) ? v.filter((a: any) => a?.availability === 'available').map((a: any) => a?.[key]) : [], 64);
  const actions = avail(el?.actions, 'name');
  const operations = avail(el?.operations, 'operation');
  const name = str(el?.name, 256);
  const states = strs(el?.states, 32);
  return {
    id: str(el?.id, 64),
    role: str(el?.role, 64),
    ...(name && { name }),
    ...(states.length && { states }),
    ...(content !== undefined && {
      text: content.length > CONTENT_MAX ? `${content.slice(0, CONTENT_MAX)}… (${content.length} chars)` : content,
    }),
    ...(actions.length && { actions }),
    ...(operations.length && { operations }),
  };
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_ELEMENT_IMAGE_BYTES = 4 * 1024 * 1024;
/** An element crop is never larger than the desktop; this leaves room for a bigger screen, not a decode bomb. */
export const MAX_ELEMENT_IMAGE_SIDE = 2048;

/** Validates a daemon element crop: base64 PNG within size, with sane IHDR dimensions. */
export function checkPng(data: unknown): { width: number; height: number } | undefined {
  if (typeof data !== 'string' || data.length === 0 || data.length > Math.ceil(MAX_ELEMENT_IMAGE_BYTES / 3) * 4)
    return undefined;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return undefined;
  const head = Buffer.from(data.slice(0, 44), 'base64');
  if (head.length < 24 || !head.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  if (head.subarray(12, 16).toString('latin1') !== 'IHDR') return undefined;
  const width = head.readUInt32BE(16);
  const height = head.readUInt32BE(20);
  if (width < 1 || height < 1 || width > MAX_ELEMENT_IMAGE_SIDE || height > MAX_ELEMENT_IMAGE_SIDE) return undefined;
  return { width, height };
}
