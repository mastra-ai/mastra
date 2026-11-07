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
$SUDO apt-get install -y -qq --no-install-recommends ca-certificates curl at-spi2-core dbus dbus-x11 libatk-adaptor kate dolphin konsole chromium >/dev/null
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
 * Boots one session bus, the accessibility layer, the four granted apps and the daemon. Idempotent;
 * restarts only what is down. Grants are composed once, from the apps this script starts.
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
  addr=$(dbus-daemon --session --fork --print-address=1 --print-pid=0 | head -1)
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
pgrep -f at-spi-bus-launcher >/dev/null || setsid nohup "$L" --launch-immediately --a11y=1 >launcher.log 2>&1 </dev/null &
for _ in $(seq 1 40); do dbus-send --session --print-reply --dest=org.a11y.Bus /org/a11y/bus org.a11y.Bus.GetAddress >/dev/null 2>&1 && break; sleep 0.25; done
for p in IsEnabled ScreenReaderEnabled; do dbus-send --session --dest=org.a11y.Bus /org/a11y/bus org.freedesktop.DBus.Properties.Set string:org.a11y.Status string:$p variant:boolean:true >/dev/null 2>&1 || true; done
[ -f "$HOME/notes.txt" ] || : > "$HOME/notes.txt"
start() { name=$1; shift; pgrep -x "$name" >/dev/null || { setsid nohup "$@" >"app-$name.log" 2>&1 </dev/null & }; }
start kate kate "$HOME/notes.txt"
start dolphin dolphin "$HOME"
start konsole konsole
pgrep -f user-data-dir=/tmp/mcc/chrome >/dev/null || setsid nohup chromium --no-sandbox --force-renderer-accessibility --no-first-run --no-default-browser-check --user-data-dir=/tmp/mcc/chrome --window-size=900,560 about:blank >app-chrome.log 2>&1 </dev/null &
if [ ! -s grants.json ]; then
  sleep 6
  A=$(dbus-send --session --print-reply --dest=org.a11y.Bus /org/a11y/bus org.a11y.Bus.GetAddress | grep -o '"[^"]*"' | tr -d '"')
  : > apps.tsv
  DBUS_SESSION_BUS_ADDRESS="$A" dbus-send --session --print-reply --dest=org.a11y.atspi.Registry /org/a11y/atspi/accessible/root org.a11y.atspi.Accessible.GetChildren \\
    | awk '/string "/{gsub(/"/,"",$2); b=$2} /object path "/{gsub(/"/,"",$3); print b" "$3}' | while read -r bus path; do
    [ -n "$bus" ] || continue
    name=$(DBUS_SESSION_BUS_ADDRESS="$A" dbus-send --session --print-reply --dest="$bus" "$path" org.freedesktop.DBus.Properties.Get string:org.a11y.atspi.Accessible string:Name 2>/dev/null | grep -o 'string "[^"]*"' | head -1 | sed 's/string "//; s/"$//')
    pid=$(DBUS_SESSION_BUS_ADDRESS="$A" dbus-send --session --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.GetConnectionUnixProcessID string:"$bus" 2>/dev/null | awk '/uint32/{print $2}')
    exe=$(readlink -f /proc/$pid/exe 2>/dev/null || true)
    [ -n "$name" ] && [ -n "$exe" ] && printf '%s\\t%s\\n' "$name" "$exe" >> apps.tsv
  done
  node -e 'const l=require("fs").readFileSync("apps.tsv","utf8").split("\\n").filter(Boolean).map(r=>r.split("\\t"));process.stdout.write(JSON.stringify({applications:l.map(([name,executable])=>({name,executable}))}))' > grants.json
fi
if ! up; then
  pkill -f "${DEST}/dist/main.mjs" 2>/dev/null || true
  setsid nohup node ${DEST}/dist/main.mjs --backend atspi --grants /tmp/mcc/grants.json \\
    --allow edit --allow activate --allow submit --allow rawInput --acquire-accessibility \\
    --audit /tmp/mcc/audit.jsonl --socket /tmp/mcc/daemon.sock --ws-port ${DAEMON_PORT} --ws-host 0.0.0.0 >daemon.log 2>&1 </dev/null &
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

export interface DaemonEvent {
  subscriptionId: string;
  id: string;
  role?: string;
  kind: string;
  attribution?: string;
  at?: number;
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

/**
 * One connection to a computer's daemon. Connects lazily, reconnects on the next call after a drop
 * (fetching a fresh preview url and cookie each time), and closes the socket on a timed-out request so a
 * hung daemon cannot wedge the computer's queue. Watches live and die with the connection.
 */
export class DaemonClient {
  #socket?: DaemonSocket;
  #opening?: Promise<DaemonSocket>;
  #next = 1;
  #buffer = '';
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

  async request(method: string, params: Record<string, unknown>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<any> {
    const socket = await this.#open();
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`the accessibility daemon did not answer ${method} in time`));
        this.#drop(socket);
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
    if (this.#socket) this.#drop(this.#socket);
  }

  #open(): Promise<DaemonSocket> {
    if (this.#closed) return Promise.reject(new Error('computer destroyed'));
    if (this.#socket) return Promise.resolve(this.#socket);
    this.#opening ??= this.#handshake().finally(() => (this.#opening = undefined));
    return this.#opening;
  }

  async #handshake(): Promise<DaemonSocket> {
    const endpoint = await this.endpoint();
    if (!endpoint) throw new Error(SEMANTIC_NO_NETWORK);
    const url = new URL(endpoint.url);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    const socket = this.connect(url.toString(), endpoint.headers);
    this.#buffer = '';
    return new Promise((resolve, reject) => {
      let hello = false;
      const timer = setTimeout(() => fail('timed out connecting to the accessibility daemon'), REQUEST_TIMEOUT_MS);
      const fail = (message: string) => {
        clearTimeout(timer);
        socket.onclose = socket.onerror = socket.onmessage = null;
        try {
          socket.close();
        } catch {}
        reject(new Error(message));
      };
      socket.onerror = () => fail('could not connect to the accessibility daemon');
      socket.onclose = () => fail('the accessibility daemon closed the connection');
      socket.onopen = () =>
        socket.send(JSON.stringify({ type: 'hello', digest: MCC_SCHEMA_DIGEST, version: MCC_SCHEMA_VERSION }) + '\n');
      socket.onmessage = ev => {
        for (const msg of this.#lines(ev.data)) {
          if (!hello) {
            if (msg.type !== 'hello' || msg.digest !== MCC_SCHEMA_DIGEST) {
              fail(
                `the accessibility daemon refused the handshake${msg.refusal?.message ? `: ${msg.refusal.message}` : ''}`,
              );
              return;
            }
            hello = true;
            clearTimeout(timer);
            this.#socket = socket;
            socket.onerror = () => this.#drop(socket);
            socket.onclose = () => this.#drop(socket);
            resolve(socket);
          } else this.#route(msg);
        }
      };
    });
  }

  *#lines(data: unknown): Generator<any> {
    this.#buffer += typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf8');
    let i: number;
    while ((i = this.#buffer.indexOf('\n')) >= 0) {
      const line = this.#buffer.slice(0, i);
      this.#buffer = this.#buffer.slice(i + 1);
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line);
      } catch {
        // A malformed line from the daemon is dropped, not fatal.
      }
    }
  }

  #route(msg: any) {
    if (msg.type === 'response') {
      const p = this.#pending.get(msg.id);
      if (p) {
        this.#pending.delete(msg.id);
        p.resolve(msg.result ?? {});
      }
    } else if (msg.type === 'event' && msg.event) {
      this.handlers.onEvent(msg.event as DaemonEvent);
    }
  }

  #drop(socket: DaemonSocket) {
    if (this.#socket !== socket) return;
    this.#socket = undefined;
    socket.onclose = socket.onerror = socket.onmessage = null;
    try {
      socket.close();
    } catch {}
    for (const [, p] of this.#pending) p.reject(new Error('the accessibility daemon connection dropped'));
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

/** The parts of an element a model needs to pick and act on it. */
export function slimElement(el: any) {
  const content = el?.content?.kind === 'text' && typeof el.content.value === 'string' ? el.content.value : undefined;
  const actions = (el?.actions ?? []).filter((a: any) => a.availability === 'available').map((a: any) => a.name);
  const operations = (el?.operations ?? [])
    .filter((o: any) => o.availability === 'available')
    .map((o: any) => o.operation);
  return {
    id: el?.id,
    role: el?.role,
    ...(el?.name && { name: el.name }),
    ...(el?.states?.length && { states: el.states }),
    ...(content !== undefined && {
      text: content.length > CONTENT_MAX ? `${content.slice(0, CONTENT_MAX)}… (${content.length} chars)` : content,
    }),
    ...(actions.length && { actions }),
    ...(operations.length && { operations }),
  };
}
