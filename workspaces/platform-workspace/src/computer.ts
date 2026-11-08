import type {
  CommandResult,
  ComputerPosition,
  ComputerScreenshot,
  ComputerScreenSize,
  SandboxComputer,
} from '@mastra/core/workspace';

export interface ComputerExecOptions {
  once: boolean;
  timeout?: number;
  env?: Record<string, string>;
}

export type ComputerExec = (
  command: string,
  args: string[] | undefined,
  opts: ComputerExecOptions,
) => Promise<CommandResult>;

export interface ComputerDriverDeps {
  exec: ComputerExec;
  viewerUrl: () => Promise<string | null>;
}

/** Packages providing the desktop: X server, window manager, VNC + noVNC, input and capture tools. */
export const DESKTOP_PACKAGES: readonly string[] = [
  'xvfb',
  'openbox',
  'x11vnc',
  'novnc',
  'websockify',
  'xdotool',
  'scrot',
  'xterm',
  'fonts-dejavu-core',
  'dbus-x11',
  'x11-utils',
];

const DISPLAY = ':1';
const SCREEN = '1024x640x24';
const VNC_PORT = 5900;
export const COMPUTER_VIEWER_PORT = 6080;
const ENV = { DISPLAY };
const ENSURE_TIMEOUT_MS = 300_000;
const ACTION_TIMEOUT_MS = 30_000;
/** Extra time per typed character or scroll click on top of `ACTION_TIMEOUT_MS`. */
const PER_STEP_TIMEOUT_MS = 50;

/**
 * Installs the desktop if any binary is missing, then starts each service whose
 * functional check fails. Fixed text: no caller input reaches it. The flock
 * serializes installs/launches across instances and transport replays; every
 * daemon closes fd 9 so none of them holds the lock after the script exits.
 */
export const ENSURE_SCRIPT = `
exec 9>/tmp/.mastra-computer.lock
flock -w 120 9 || exit 75
missing=0
for b in Xvfb openbox x11vnc websockify xdotool scrot xdpyinfo xprop xterm; do
  command -v "$b" >/dev/null 2>&1 || missing=1
done
[ -f /usr/share/novnc/vnc.html ] || missing=1
[ -f /usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf ] || missing=1
if [ "$missing" = 1 ]; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq >/tmp/.mastra-computer-install.log 2>&1 &&
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends ${DESKTOP_PACKAGES.join(' ')} >>/tmp/.mastra-computer-install.log 2>&1 ||
    { echo "desktop install failed:" >&2; tail -5 /tmp/.mastra-computer-install.log >&2; exit 1; }
fi
export DISPLAY=${DISPLAY}
n=0
deadline=$((SECONDS + 15))
x_ok() { xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; }
wm_ok() {
  wm=$(xprop -display ${DISPLAY} -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | sed -n 's/.*window id # //p')
  [ -n "$wm" ] && xprop -display ${DISPLAY} -id "$wm" _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q "window id # $wm"
}
vnc_ok() { bash -c '</dev/tcp/127.0.0.1/${VNC_PORT}' >/dev/null 2>&1; }
web_ok() { curl -sf -o /dev/null http://127.0.0.1:${COMPUTER_VIEWER_PORT}/vnc.html; }
term_ok() { xdotool search --class xterm >/dev/null 2>&1; }
launch() { log="/tmp/.mastra-computer-$1.log"; setsid nohup "$@" >"$log" 2>&1 9>&- & n=$((n + 1)); }
await_ok() { until "$1"; do [ "$SECONDS" -ge "$deadline" ] && { echo "desktop not ready: $1" >&2; exit 1; }; sleep 0.2; done; }
x_ok || launch Xvfb ${DISPLAY} -screen 0 ${SCREEN} -ac
await_ok x_ok
wm_ok || launch openbox
await_ok wm_ok
vnc_ok || launch x11vnc -display ${DISPLAY} -forever -shared -nopw -rfbport ${VNC_PORT} -localhost
await_ok vnc_ok
web_ok || launch websockify --web /usr/share/novnc 0.0.0.0:${COMPUTER_VIEWER_PORT} 127.0.0.1:${VNC_PORT}
await_ok web_ok
term_ok || launch xterm -fa 'DejaVu Sans Mono' -fs 14
await_ok term_ok
echo "$(date -u +%FT%TZ) launched=$n" >>/tmp/.mastra-computer-ensure.log
echo "launched=$n"
echo ready
`;

/** Writes the PNG, prints its byte count on line 1, then the base64 body. */
export const SCREENSHOT_SCRIPT =
  "scrot -o -z /tmp/.mastra-computer.png && printf '%s\\n' \"$(wc -c < /tmp/.mastra-computer.png | tr -d ' ')\" && base64 -w0 /tmp/.mastra-computer.png";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IEND = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

/** Lower-cased friendly names → X keysyms. Anything else passes through unchanged. */
const KEY_ALIASES: Record<string, string> = {
  enter: 'Return',
  return: 'Return',
  esc: 'Escape',
  escape: 'Escape',
  backspace: 'BackSpace',
  tab: 'Tab',
  delete: 'Delete',
  del: 'Delete',
  home: 'Home',
  end: 'End',
  insert: 'Insert',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  pageup: 'Prior',
  pagedown: 'Next',
  space: 'space',
  ' ': 'space',
  '+': 'plus',
  control: 'ctrl',
  ctrl: 'ctrl',
  meta: 'super',
  cmd: 'super',
  command: 'super',
  super: 'super',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
};

function toKeysym(key: string): string {
  return KEY_ALIASES[key.toLowerCase()] ?? key;
}

function assertCoord(name: string, value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer, got ${String(value)}`);
  }
  return String(value);
}

function tail(text: string): string {
  return text.trim().split('\n').slice(-5).join('\n');
}

function hasBytes(data: Uint8Array, offset: number, expected: number[]): boolean {
  return expected.every((b, i) => data[offset + i] === b);
}

export function createComputer({ exec, viewerUrl }: ComputerDriverDeps): SandboxComputer {
  let ready: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const check = (name: string, result: CommandResult): CommandResult => {
    if (result.exitCode !== 0 || result.timedOut) {
      // Any failure may mean the desktop died; the next call re-runs the (idempotent) start script.
      ready = undefined;
      const reason = result.timedOut ? 'timed out' : `exit ${result.exitCode}`;
      throw new Error(`computer ${name} failed (${reason}): ${tail(result.stderr)}`);
    }
    return result;
  };

  const ensureDesktop = (): Promise<void> => {
    ready ??= exec('bash', ['-c', ENSURE_SCRIPT], { once: false, timeout: ENSURE_TIMEOUT_MS, env: ENV })
      .then(result => {
        check('desktop start', result);
        if (!result.stdout.split('\n').includes('ready')) {
          throw new Error(`computer desktop start did not report ready: ${tail(result.stderr)}`);
        }
      })
      .catch(err => {
        ready = undefined;
        throw err;
      });
    return ready;
  };

  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const task = () => ensureDesktop().then(fn);
    const result = queue.then(task, task);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const input =
    (name: string, args: string[], timeout = ACTION_TIMEOUT_MS) =>
    async () => {
      check(name, await exec('xdotool', args, { once: true, timeout, env: ENV }));
    };

  const read = async (name: string, args: string[]) =>
    check(name, await exec('xdotool', args, { once: false, timeout: ACTION_TIMEOUT_MS, env: ENV }));

  return {
    screenshot: () =>
      run(async (): Promise<ComputerScreenshot> => {
        const { stdout } = check(
          'screenshot',
          await exec(SCREENSHOT_SCRIPT, undefined, { once: false, timeout: ACTION_TIMEOUT_MS, env: ENV }),
        );
        const newline = stdout.indexOf('\n');
        const expected = Number(stdout.slice(0, newline));
        const data = new Uint8Array(Buffer.from(stdout.slice(newline + 1).trim(), 'base64'));
        if (newline < 0 || !Number.isInteger(expected) || data.byteLength !== expected) {
          throw new Error(`computer screenshot truncated: got ${data.byteLength} bytes, expected ${expected}`);
        }
        if (!hasBytes(data, 0, PNG_SIGNATURE)) throw new Error('computer screenshot is not a PNG');
        if (
          data.byteLength < PNG_SIGNATURE.length + PNG_IEND.length ||
          !hasBytes(data, data.byteLength - 12, PNG_IEND)
        ) {
          throw new Error('computer screenshot is missing the PNG IEND trailer');
        }
        return { data, mediaType: 'image/png' };
      }),
    leftClick: async (x, y) =>
      run(input('leftClick', ['mousemove', assertCoord('x', x), assertCoord('y', y), 'click', '1'])),
    rightClick: async (x, y) =>
      run(input('rightClick', ['mousemove', assertCoord('x', x), assertCoord('y', y), 'click', '3'])),
    doubleClick: async (x, y) =>
      run(
        input('doubleClick', [
          'mousemove',
          assertCoord('x', x),
          assertCoord('y', y),
          'click',
          '--repeat',
          '2',
          '--delay',
          '80',
          '1',
        ]),
      ),
    moveMouse: async (x, y) => run(input('moveMouse', ['mousemove', assertCoord('x', x), assertCoord('y', y)])),
    drag: async (from: ComputerPosition, to: ComputerPosition) =>
      run(
        input('drag', [
          'mousemove',
          assertCoord('from.x', from.x),
          assertCoord('from.y', from.y),
          'mousedown',
          '1',
          'mousemove',
          assertCoord('to.x', to.x),
          assertCoord('to.y', to.y),
          'mouseup',
          '1',
        ]),
      ),
    scroll: async (direction, amount) => {
      if (!Number.isInteger(amount) || amount < 1) {
        throw new TypeError(`scroll amount must be a positive integer, got ${String(amount)}`);
      }
      if (direction !== 'up' && direction !== 'down') {
        throw new TypeError(`scroll direction must be 'up' or 'down', got ${String(direction)}`);
      }
      return run(
        input(
          'scroll',
          ['click', '--repeat', String(amount), direction === 'up' ? '4' : '5'],
          ACTION_TIMEOUT_MS + amount * PER_STEP_TIMEOUT_MS,
        ),
      );
    },
    type: async text => {
      if (typeof text !== 'string') throw new TypeError('type text must be a string');
      return run(
        input(
          'type',
          ['type', '--clearmodifiers', '--delay', '12', '--', text],
          ACTION_TIMEOUT_MS + text.length * PER_STEP_TIMEOUT_MS,
        ),
      );
    },
    press: async key => {
      // 'ctrl+Enter' and ['ctrl', 'Enter'] are the same chord; a '+' with nothing after it is the plus key.
      const parts = (Array.isArray(key) ? key : [key]).flatMap(k => (typeof k === 'string' ? k.split(/\+(?=.)/) : [k]));
      if (parts.length === 0 || parts.some(k => typeof k !== 'string' || k.length === 0)) {
        throw new TypeError('press key must be a non-empty string or array of non-empty strings');
      }
      return run(input('press', ['key', '--clearmodifiers', '--', parts.map(toKeysym).join('+')]));
    },
    getScreenSize: () =>
      run(async (): Promise<ComputerScreenSize> => {
        const { stdout } = await read('getScreenSize', ['getdisplaygeometry']);
        const [width, height] = stdout.trim().split(/\s+/).map(Number);
        if (!Number.isInteger(width) || !Number.isInteger(height)) {
          throw new Error(`computer getScreenSize: unexpected output ${JSON.stringify(stdout.slice(0, 80))}`);
        }
        return { width: width!, height: height! };
      }),
    getCursorPosition: () =>
      run(async (): Promise<ComputerPosition> => {
        const { stdout } = await read('getCursorPosition', ['getmouselocation', '--shell']);
        const x = Number(/^X=(\d+)$/m.exec(stdout)?.[1]);
        const y = Number(/^Y=(\d+)$/m.exec(stdout)?.[1]);
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
          throw new Error(`computer getCursorPosition: unexpected output ${JSON.stringify(stdout.slice(0, 80))}`);
        }
        return { x, y };
      }),
    streamUrl: () => run(viewerUrl),
  };
}

export { createComputer as createPlatformComputer };
