import type {
  CommandResult,
  ComputerPosition,
  ComputerScreenshot,
  ComputerScreenSize,
  SandboxComputer,
} from '@mastra/core/workspace';

import {
  ACCESSIBILITY_HELPER,
  ACCESSIBILITY_HELPER_PATH,
  ACCESSIBILITY_HELPER_SHA256,
  createComputerAccessibility,
  DESKTOP_DIR,
  DESKTOP_ENV,
} from './computer-accessibility.js';

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

export interface PlatformComputerDeps {
  exec: ComputerExec;
  viewerUrl: () => Promise<string | null>;
  /**
   * How the sandbox's template was given: a builder with `.desktop()`, or a
   * template resolved later / a checkpoint, whose desktop can only be checked
   * in the running sandbox. Picks the fix named when the desktop is missing.
   */
  template: 'builder' | 'prebuilt';
}

export const COMPUTER_VIEWER_PORT = 6080;
const CAPABILITY_TIMEOUT_MS = 35_000;
const HASH_TIMEOUT_MS = 5_000;
const UPLOAD_TIMEOUT_MS = 10_000;
const PROBE_TIMEOUT_MS = 10_000;
const ACTION_TIMEOUT_MS = 30_000;
/** Extra time per typed character or scroll click on top of `ACTION_TIMEOUT_MS`. */
const PER_STEP_TIMEOUT_MS = 50;

/**
 * The image boots the desktop; this only asks whether it has one and waits
 * (up to 30 s) while systemd still starts it. The sandbox user cannot reach
 * systemd itself (no system bus on E2B), so it asks through `sudo -n`.
 * Exit 3: no desktop unit. Exit 4: systemd cannot be asked. Exit 5: not
 * active in time (state on stderr).
 */
export const CAPABILITY_SCRIPT = [
  'S=; [ "$(id -u)" = 0 ] || S="sudo -n"',
  'load=$($S systemctl show -p LoadState --value mastra-desktop 2>/dev/null) || exit 4',
  '[ "$load" = loaded ] || exit 3',
  'state=unknown',
  'for _ in $(seq 1 60); do',
  `  state=$($S systemctl is-active mastra-desktop 2>/dev/null) && test -f ${DESKTOP_DIR}/generation && exit 0`,
  '  sleep 0.5',
  'done',
  'echo "state=$state" >&2',
  'exit 5',
].join('\n');

/** `$1` = destination, `$2` = base64 helper bytes. Written to a temp file and renamed, so a reader never sees half a file. */
export const UPLOAD_SCRIPT = 'umask 077 && t="$1.tmp.$$" && printf %s "$2" | base64 -d > "$t" && mv -f "$t" "$1"';

/**
 * `$1` = helper path. One exec, each probe named on failure; the helper's
 * ping reply (with the desktop generation) is the last stdout line.
 */
export const PROBE_SCRIPT = [
  'fail() { echo "probe=$1" >&2; exit 1; }',
  'S=; [ "$(id -u)" = 0 ] || S="sudo -n"',
  '$S systemctl is-active --quiet mastra-desktop || fail unit',
  'xdotool getdisplaygeometry >/dev/null 2>&1 || fail display',
  `curl -fsS -o /dev/null http://127.0.0.1:${COMPUTER_VIEWER_PORT}/vnc.html || fail viewer`,
  `out=$(/usr/bin/python3 "$1" '{"op":"ping"}') || fail accessibility`,
  'printf "%s\\n" "$out"',
].join('\n');

const PROBE_FIXES: Record<string, string> = {
  unit: 'the mastra-desktop service is not running',
  display: 'the X display :1 does not answer',
  viewer: `the noVNC viewer on port ${COMPUTER_VIEWER_PORT} does not answer`,
  accessibility: 'the accessibility helper cannot reach the desktop',
};

/** Writes the PNG, prints its byte count on line 1, then the base64 body. */
const SCREENSHOT_FILE = `${DESKTOP_DIR}/screenshot.png`;
export const SCREENSHOT_SCRIPT = `scrot -o -z ${SCREENSHOT_FILE} && printf '%s\\n' "$(wc -c < ${SCREENSHOT_FILE} | tr -d ' ')" && base64 -w0 ${SCREENSHOT_FILE}`;

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

export interface PlatformComputer extends SandboxComputer {
  /** Forget the readiness check: the sandbox stopped or is a different VM now. */
  resetReadiness(): void;
}

/** The desktop computer for a sandbox whose image boots the desktop. */
export function createPlatformComputer({ exec: rawExec, viewerUrl, template }: PlatformComputerDeps): PlatformComputer {
  // Memoized readiness: one shared in-flight check, cleared on any failure.
  let ready: Promise<string> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const env = { ...DESKTOP_ENV };

  const unhealthy = () => {
    ready = undefined;
  };

  // A command that never came back says nothing about the desktop it ran on: check it again next time.
  const exec: ComputerExec = async (command, args, opts) => {
    try {
      return await rawExec(command, args, opts);
    } catch (error) {
      unhealthy();
      if (!opts.once) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `computer ${command}: the command channel failed (${reason}); the outcome is unknown, so check the screen before retrying`,
        { cause: error },
      );
    }
  };

  const check = (name: string, result: CommandResult): CommandResult => {
    if (result.exitCode !== 0 || result.timedOut) {
      // Any failure may mean the desktop restarted or died; the next call checks again.
      unhealthy();
      const reason = result.timedOut ? 'timed out' : `exit ${result.exitCode}`;
      throw new Error(`computer ${name} failed (${reason}): ${tail(result.stderr)}`);
    }
    return result;
  };

  const missingDesktop = () =>
    template === 'builder'
      ? 'computer: this sandbox has no running desktop. Build its template with `.desktop()` (Template().desktop()) and wait for the build to finish.'
      : 'computer: this template has no desktop; rebuild it with `.desktop()`.';

  const checkDesktop = async (): Promise<string> => {
    const capability = await exec('bash', ['-c', CAPABILITY_SCRIPT], {
      once: false,
      timeout: CAPABILITY_TIMEOUT_MS,
      env,
    });
    if (capability.timedOut || capability.exitCode === 5) {
      const state = /state=(\S+)/.exec(capability.stderr)?.[1] ?? 'unknown';
      throw new Error(
        `computer: the desktop is still starting (systemd state ${state}). It restarts itself; retry shortly, and if it persists recreate the sandbox.`,
      );
    }
    if (capability.exitCode === 4) {
      throw new Error(
        'computer: cannot ask systemd whether the desktop runs; the sandbox user needs passwordless sudo, as on E2B images.',
      );
    }
    if (capability.exitCode === 3) throw new Error(missingDesktop());
    if (capability.exitCode !== 0) {
      throw new Error(
        `computer: the desktop check failed (exit ${capability.exitCode}): ${capability.stderr.trim().slice(-200) || 'no output'}`,
      );
    }

    const hash = await exec('sha256sum', ['--', ACCESSIBILITY_HELPER_PATH], {
      once: false,
      timeout: HASH_TIMEOUT_MS,
      env,
    });
    if (hash.exitCode !== 0 || hash.timedOut || hash.stdout.split(/\s/)[0] !== ACCESSIBILITY_HELPER_SHA256) {
      const base64 = Buffer.from(ACCESSIBILITY_HELPER, 'utf8').toString('base64');
      check(
        'accessibility helper upload',
        await exec('bash', ['-c', UPLOAD_SCRIPT, 'upload', ACCESSIBILITY_HELPER_PATH, base64], {
          once: false,
          timeout: UPLOAD_TIMEOUT_MS,
          env,
        }),
      );
    }

    const probe = await exec('bash', ['-c', PROBE_SCRIPT, 'probe', ACCESSIBILITY_HELPER_PATH], {
      once: false,
      timeout: PROBE_TIMEOUT_MS,
      env,
    });
    if (probe.exitCode !== 0 || probe.timedOut) {
      const failed = /probe=(\w+)/.exec(probe.stderr)?.[1];
      const what = probe.timedOut
        ? `the desktop probes timed out after ${PROBE_TIMEOUT_MS / 1000}s`
        : (PROBE_FIXES[failed ?? ''] ?? `the desktop probes failed (exit ${probe.exitCode})`);
      throw new Error(
        `computer: ${what}. The desktop restarts itself; retry shortly, and if it persists recreate the sandbox. ${tail(probe.stderr)}`.trim(),
      );
    }
    let generation: unknown;
    try {
      generation = (JSON.parse(probe.stdout.trim().split('\n').pop() ?? '') as { generation?: unknown }).generation;
    } catch {
      generation = undefined;
    }
    if (typeof generation !== 'string')
      throw new Error('computer: the accessibility helper ping returned no generation');
    return generation;
  };

  const ensureReady = (): Promise<string> => {
    if (!ready) {
      const attempt = checkDesktop();
      ready = attempt;
      attempt.catch(() => {
        if (ready === attempt) ready = undefined;
      });
    }
    return ready;
  };

  /** The helper saw another desktop generation than the memo: the desktop restarted. */
  const seenGeneration = async (generation: string) => {
    if (ready && (await ready.catch(() => undefined)) !== generation) unhealthy();
  };

  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    // A reset while this task waited (stop, a new VM) means that check was for another desktop.
    const task = async () => {
      for (;;) {
        const check = ensureReady();
        await check;
        if (ready === check) return fn();
      }
    };
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
      check(name, await exec('xdotool', args, { once: true, timeout, env }));
    };

  const read = async (name: string, args: string[]) =>
    check(name, await exec('xdotool', args, { once: false, timeout: ACTION_TIMEOUT_MS, env }));

  return {
    screenshot: () =>
      run(async (): Promise<ComputerScreenshot> => {
        const { stdout } = check(
          'screenshot',
          await exec(SCREENSHOT_SCRIPT, undefined, { once: false, timeout: ACTION_TIMEOUT_MS, env }),
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
    // Accessibility words its own transport failures (and clears the check itself).
    accessibility: createComputerAccessibility({ exec: rawExec, run, unhealthy, seenGeneration }),
    resetReadiness: unhealthy,
  };
}
