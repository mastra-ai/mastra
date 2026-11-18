import { describe, expect, it, vi } from 'vitest';

import { DESKTOP_ENV } from './computer-accessibility.js';
import {
  CAPABILITY_SCRIPT,
  createPlatformComputer,
  PROBE_SCRIPT,
  SCREENSHOT_SCRIPT,
  UPLOAD_SCRIPT,
} from './computer.js';
import { fakeDesktop, ok, result } from './computer.test-fixtures.js';
import type { Call, Responder } from './computer.test-fixtures.js';

function setup(
  respond: Responder = () => ok(),
  viewer: () => Promise<string | null> = async () => 'https://v/',
  template: 'builder' | 'prebuilt' = 'builder',
  override: Parameters<typeof fakeDesktop>[1] = {},
) {
  const fake = fakeDesktop(respond, override);
  const computer = createPlatformComputer({ exec: fake.exec, viewerUrl: viewer, template });
  return { computer, ...fake };
}

function png(body = [1, 2, 3, 4]): Buffer {
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...body,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82,
  ]);
}

const screenshotOut = (bytes: Buffer, count = bytes.byteLength) => ok(`${count}\n${bytes.toString('base64')}`);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('createPlatformComputer', () => {
  describe('command mapping', () => {
    const input = { once: true, timeout: 30_000, env: { ...DESKTOP_ENV } };
    const read = { once: false, timeout: 30_000, env: { ...DESKTOP_ENV } };

    it.each([
      ['leftClick', (c: any) => c.leftClick(10, 20), ['mousemove', '10', '20', 'click', '1']],
      ['rightClick', (c: any) => c.rightClick(10, 20), ['mousemove', '10', '20', 'click', '3']],
      [
        'doubleClick',
        (c: any) => c.doubleClick(10, 20),
        ['mousemove', '10', '20', 'click', '--repeat', '2', '--delay', '80', '1'],
      ],
      ['moveMouse', (c: any) => c.moveMouse(0, 799), ['mousemove', '0', '799']],
      [
        'drag',
        (c: any) => c.drag({ x: 1, y: 2 }, { x: 3, y: 4 }),
        ['mousemove', '1', '2', 'mousedown', '1', 'mousemove', '3', '4', 'mouseup', '1'],
      ],
      ['scroll up', (c: any) => c.scroll('up', 3), ['click', '--repeat', '3', '4']],
      ['scroll down', (c: any) => c.scroll('down', 1), ['click', '--repeat', '1', '5']],
      ['type', (c: any) => c.type('hello world'), ['type', '--clearmodifiers', '--delay', '12', '--', 'hello world']],
      ['press Enter', (c: any) => c.press('Enter'), ['key', '--clearmodifiers', '--', 'Return']],
      ['press chord', (c: any) => c.press(['ctrl', 's']), ['key', '--clearmodifiers', '--', 'ctrl+s']],
      [
        'press aliases',
        (c: any) => c.press(['Control', 'Shift', 'ArrowUp']),
        ['key', '--clearmodifiers', '--', 'ctrl+shift+Up'],
      ],
      ['press passthrough', (c: any) => c.press('F5'), ['key', '--clearmodifiers', '--', 'F5']],
    ])('%s sends xdotool argv once-only with DISPLAY=:1', async (_name, act, args) => {
      const { computer, work } = setup();
      await act(computer);
      expect(work()).toEqual([{ command: 'xdotool', args, opts: { ...input, timeout: expect.any(Number) } }]);
    });

    it('scales the timeout of long inputs', async () => {
      const { computer, work } = setup();
      await computer.type('x'.repeat(1000));
      await computer.scroll('down', 10);
      expect(work().map(c => c.opts.timeout)).toEqual([30_000 + 1000 * 50, 30_000 + 10 * 50]);
    });

    it.each([
      ['ctrl+Enter', 'ctrl+Return'],
      ['Control+Shift+ArrowUp', 'ctrl+shift+Up'],
      ['ctrl++', 'ctrl+plus'],
      ['+', 'plus'],
    ])('splits combo string %s into %s', async (key, keysym) => {
      const { computer, work } = setup();
      await computer.press(key);
      expect(work()[0]!.args).toEqual(['key', '--clearmodifiers', '--', keysym]);
    });

    it.each([
      ['Escape', 'Escape'],
      ['Esc', 'Escape'],
      ['Backspace', 'BackSpace'],
      ['Tab', 'Tab'],
      ['PageUp', 'Prior'],
      ['PageDown', 'Next'],
      ['Space', 'space'],
      ['Meta', 'super'],
      ['Cmd', 'super'],
      ['Alt', 'alt'],
      ['enter', 'Return'],
      ['a', 'a'],
      ['A', 'A'],
    ])('maps key %s to %s', async (key, keysym) => {
      const { computer, work } = setup();
      await computer.press(key);
      expect(work()[0]!.args).toEqual(['key', '--clearmodifiers', '--', keysym]);
    });

    it('getScreenSize parses getdisplaygeometry', async () => {
      const { computer, work } = setup(() => ok('1280 800\n'));
      await expect(computer.getScreenSize()).resolves.toEqual({ width: 1280, height: 800 });
      expect(work()).toEqual([{ command: 'xdotool', args: ['getdisplaygeometry'], opts: read }]);
    });

    it('getCursorPosition parses getmouselocation --shell', async () => {
      const { computer, work } = setup(() => ok('X=12\nY=34\nSCREEN=0\nWINDOW=99\n'));
      await expect(computer.getCursorPosition()).resolves.toEqual({ x: 12, y: 34 });
      expect(work()).toEqual([{ command: 'xdotool', args: ['getmouselocation', '--shell'], opts: read }]);
    });

    it('screenshot runs the fixed script as a read', async () => {
      const bytes = png();
      const { computer, work } = setup(() => screenshotOut(bytes));
      const shot = await computer.screenshot();
      expect(shot.mediaType).toBe('image/png');
      expect(Buffer.from(shot.data).equals(bytes)).toBe(true);
      expect(work()).toEqual([{ command: SCREENSHOT_SCRIPT, args: undefined, opts: read }]);
    });

    it('streamUrl returns the viewer URL and passes null through', async () => {
      expect(await setup(undefined, async () => 'https://6080-sb/vnc.html').computer.streamUrl!()).toBe(
        'https://6080-sb/vnc.html',
      );
      expect(await setup(undefined, async () => null).computer.streamUrl!()).toBeNull();
    });
  });

  describe('untrusted input stays in argv', () => {
    it('type passes shell metacharacters as one argument', async () => {
      const text = "x'; touch /tmp/pwned; echo '";
      const { computer, work } = setup();
      await computer.type(text);
      expect(work()[0]).toMatchObject({
        command: 'xdotool',
        args: ['type', '--clearmodifiers', '--delay', '12', '--', text],
      });
    });

    it('press passes a quoted key as part of one argument', async () => {
      const { computer, work } = setup();
      await computer.press(['ctrl', "a'b"]);
      expect(work()[0]).toMatchObject({ command: 'xdotool', args: ['key', '--clearmodifiers', '--', "ctrl+a'b"] });
    });
  });

  describe('argument validation', () => {
    it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects coordinate %s without exec', async bad => {
      const { computer, calls } = setup();
      await expect(computer.leftClick(bad, 0)).rejects.toBeInstanceOf(TypeError);
      await expect(computer.moveMouse(0, bad)).rejects.toBeInstanceOf(TypeError);
      await expect(computer.drag({ x: 0, y: 0 }, { x: bad, y: 0 })).rejects.toBeInstanceOf(TypeError);
      expect(calls).toHaveLength(0);
    });

    it.each([0, -2, 1.5])('rejects scroll amount %s without exec', async bad => {
      const { computer, calls } = setup();
      await expect(computer.scroll('down', bad)).rejects.toBeInstanceOf(TypeError);
      expect(calls).toHaveLength(0);
    });

    it('rejects non-string text and keys without exec', async () => {
      const { computer, calls } = setup();
      await expect(computer.type(42 as unknown as string)).rejects.toBeInstanceOf(TypeError);
      await expect(computer.press([] as string[])).rejects.toBeInstanceOf(TypeError);
      await expect(computer.press(['ctrl', 1 as unknown as string])).rejects.toBeInstanceOf(TypeError);
      expect(calls).toHaveLength(0);
    });
  });

  describe('screenshot validation', () => {
    it('throws on a short base64 body', async () => {
      const bytes = png();
      const { computer } = setup(() => ok(`${bytes.byteLength}\n${bytes.toString('base64').slice(0, 12)}`));
      await expect(computer.screenshot()).rejects.toThrow(/truncated/);
    });

    it('throws on a length mismatch', async () => {
      const bytes = png();
      const { computer } = setup(() => screenshotOut(bytes, bytes.byteLength + 1));
      await expect(computer.screenshot()).rejects.toThrow(/truncated/);
    });

    it('throws on a bad signature', async () => {
      const bytes = png();
      bytes[1] = 0;
      const { computer } = setup(() => screenshotOut(bytes));
      await expect(computer.screenshot()).rejects.toThrow(/not a PNG/);
    });

    it('throws on a missing IEND trailer', async () => {
      const bytes = png().subarray(0, -1);
      const { computer } = setup(() => screenshotOut(Buffer.from(bytes)));
      await expect(computer.screenshot()).rejects.toThrow(/IEND/);
    });
  });

  describe('failures', () => {
    it('throws with the command name and stderr on non-zero exit', async () => {
      const { computer } = setup(() => ({ exitCode: 1, stdout: 'ignored', stderr: 'boom happened' }));
      await expect(computer.leftClick(1, 1)).rejects.toThrow(/leftClick failed \(exit 1\): boom happened/);
    });

    it('throws when the command timed out', async () => {
      const { computer } = setup(() => ({ exitCode: 124, timedOut: true, stderr: '' }));
      await expect(computer.getScreenSize()).rejects.toThrow(/timed out/);
    });

    it("re-runs the readiness check after Can't open display", async () => {
      let fail = true;
      const { computer, checks } = setup(() => {
        if (fail) {
          fail = false;
          return { exitCode: 1, stderr: "Can't open display: (null)\nFailed creating new xdo instance" };
        }
        return ok();
      });
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(/Can't open display/);
      expect(checks()).toBe(1);
      await computer.moveMouse(1, 1);
      expect(checks()).toBe(2);
    });

    it('re-runs the readiness check after a failed screenshot (scrot words the display error differently)', async () => {
      let fail = true;
      const bytes = png();
      const { computer, checks } = setup(() => {
        if (fail) {
          fail = false;
          return { exitCode: 1, stderr: "giblib error: Can't open X display. It *is* running, yeah?" };
        }
        return screenshotOut(bytes);
      });
      await expect(computer.screenshot()).rejects.toThrow(/Can't open X display/);
      await expect(computer.screenshot()).resolves.toMatchObject({ mediaType: 'image/png' });
      expect(checks()).toBe(2);
    });
  });

  describe('desktop readiness', () => {
    it('checks the image desktop, uploads the helper, then probes, before the first call', async () => {
      const { computer, calls, steps, helperPath } = setup();
      await computer.moveMouse(1, 1);
      expect(steps()).toEqual(['capability', 'hash', 'upload', 'probe', 'work']);
      const env = { ...DESKTOP_ENV };
      expect(calls.slice(0, 4).map(c => [c.command, c.args?.slice(0, 2), c.opts])).toEqual([
        ['bash', ['-c', CAPABILITY_SCRIPT], { once: false, timeout: 35_000, env }],
        ['sha256sum', ['--', helperPath], { once: false, timeout: 5_000, env }],
        ['bash', ['-c', UPLOAD_SCRIPT], { once: false, timeout: 10_000, env }],
        ['bash', ['-c', PROBE_SCRIPT], { once: false, timeout: 10_000, env }],
      ]);
      expect(calls[2]!.args!.slice(2, 4)).toEqual(['upload', helperPath]);
      expect(calls[3]!.args!.slice(2)).toEqual(['probe', helperPath]);
    });

    it('names the image desktop service, generation file and every functional probe', () => {
      for (const line of [
        'load=$($S systemctl show -p LoadState --value mastra-desktop 2>/dev/null) || exit 4',
        '  state=$($S systemctl is-active mastra-desktop 2>/dev/null) && test -f /tmp/.mastra-desktop/generation && exit 0',
      ]) {
        expect(CAPABILITY_SCRIPT.split('\n')).toContain(line);
      }
      for (const probe of [
        '$S systemctl is-active --quiet mastra-desktop || fail unit',
        'xdotool getdisplaygeometry >/dev/null 2>&1 || fail display',
        'curl -fsS -o /dev/null http://127.0.0.1:6080/vnc.html || fail viewer',
        `/usr/bin/python3 "$1" '{"op":"ping"}'`,
      ]) {
        expect(PROBE_SCRIPT).toContain(probe);
      }
    });

    it('skips the upload when the helper is already there with the right hash', async () => {
      const { computer, desktop, steps } = setup();
      desktop.helper = (await import('./computer-accessibility.js')).accessibilityHelperFile().sha256;
      await computer.moveMouse(1, 1);
      expect(steps()).toEqual(['capability', 'hash', 'probe', 'work']);
    });

    it('uploads again when the helper on disk has another hash', async () => {
      const { computer, desktop, uploads } = setup();
      desktop.helper = 'f'.repeat(64);
      await computer.moveMouse(1, 1);
      expect(uploads()).toHaveLength(1);
    });

    it('checks once for later calls', async () => {
      const { computer, checks, uploads } = setup();
      await computer.moveMouse(1, 1);
      await computer.moveMouse(2, 2);
      await computer.getCursorPosition().catch(() => undefined);
      expect(checks()).toBe(1);
      expect(uploads()).toHaveLength(1);
    });

    it('5 concurrent first calls share one check', async () => {
      const { computer, checks, uploads, work } = setup();
      await Promise.all([1, 2, 3, 4, 5].map(n => computer.moveMouse(n, n)));
      expect(checks()).toBe(1);
      expect(uploads()).toHaveLength(1);
      expect(work()).toHaveLength(5);
    });

    it('a builder template without a desktop says to add .desktop(), uploading nothing', async () => {
      const { computer, steps } = setup(undefined, undefined, 'builder', {
        capability: () => ({ exitCode: 3, stderr: '' }),
      });
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(/Template\(\)\.desktop\(\)/);
      expect(steps()).toEqual(['capability']);
    });

    it('a prebuilt template without a desktop says to rebuild it with .desktop(), uploading nothing', async () => {
      const { computer, steps } = setup(undefined, undefined, 'prebuilt', {
        capability: () => ({ exitCode: 3, stderr: '' }),
      });
      await expect(computer.screenshot()).rejects.toThrow('this template has no desktop; rebuild it with `.desktop()`');
      expect(steps()).toEqual(['capability']);
    });

    it.each([
      [
        'not active in time',
        { exitCode: 5, stderr: 'state=activating\n' },
        /still starting \(systemd state activating\)/,
      ],
      ['timed out', { exitCode: null, timedOut: true, stderr: '' }, /still starting \(systemd state unknown\)/],
      ['systemd unreachable', { exitCode: 4, stderr: '' }, /needs passwordless sudo/],
    ])('a desktop that is %s is not blamed on the template', async (_case, reply, message) => {
      const { computer, checks } = setup(undefined, undefined, 'builder', { capability: () => reply });
      const error = computer.moveMouse(1, 1);
      await expect(error).rejects.toThrow(message);
      await expect(error).rejects.not.toThrow(/\.desktop\(\)/);
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(message);
      expect(checks()).toBe(2);
    });

    it('asks systemd through sudo -n as a non-root user, through a real shell', async () => {
      const { execFile } = await import('node:child_process');
      const { mkdtemp, writeFile, readFile, chmod, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const bin = await mkdtemp(join(tmpdir(), 'cap-'));
      const fake = async (name: string, body: string) => {
        await writeFile(join(bin, name), `#!/bin/sh\n${body}\n`);
        await chmod(join(bin, name), 0o755);
      };
      const run = (load: string) =>
        new Promise<{ code: number; log: string }>(resolve => {
          execFile(
            'bash',
            ['-c', CAPABILITY_SCRIPT],
            { env: { PATH: `${bin}:/usr/bin:/bin`, LOAD: load } },
            async error => {
              const log = await readFile(join(bin, 'log'), 'utf8').catch(() => '');
              await rm(join(bin, 'log'), { force: true });
              resolve({ code: error ? Number(error.code) : 0, log });
            },
          );
        });
      try {
        await fake('id', 'echo 1000');
        await fake('sudo', `echo "sudo $*" >> ${join(bin, 'log')}; shift; exec "$@"`);
        await fake('systemctl', '[ "$LOAD" = fail ] && exit 1; echo "$LOAD"');
        expect(await run('not-found')).toEqual({
          code: 3,
          log: 'sudo -n systemctl show -p LoadState --value mastra-desktop\n',
        });
        expect((await run('fail')).code).toBe(4);
      } finally {
        await rm(bin, { recursive: true, force: true });
      }
    });

    it('re-runs the helper upload when the hash check timed out', async () => {
      const { computer, desktop, steps } = setup(undefined, undefined, 'builder', {
        hash: () => ({ exitCode: 0, timedOut: true, stdout: `${desktop.helper ?? ''}  x\n` }),
      });
      desktop.helper = (await import('./computer-accessibility.js')).accessibilityHelperFile().sha256;
      await computer.moveMouse(1, 1);
      expect(steps()).toEqual(['capability', 'hash', 'upload', 'probe', 'work']);
    });

    it('a pixel call whose command channel throws clears the check, and says a lost input has an unknown outcome', async () => {
      let fail = true;
      const { computer, checks } = setup(() => {
        if (fail) {
          fail = false;
          throw new Error('socket hang up');
        }
        return ok();
      });
      await expect(computer.leftClick(1, 1)).rejects.toThrow(
        /command channel failed \(socket hang up\); the outcome is unknown, so check the screen before retrying/,
      );
      await computer.leftClick(1, 1);
      expect(checks()).toBe(2);
    });

    it('a read whose command channel throws clears the check and keeps its error', async () => {
      let fail = true;
      const { computer, checks } = setup(() => {
        if (fail) {
          fail = false;
          throw new Error('socket hang up');
        }
        return ok('X=1\nY=2\n');
      });
      await expect(computer.getCursorPosition()).rejects.toThrow(/^socket hang up$/);
      await computer.getCursorPosition();
      expect(checks()).toBe(2);
    });

    it('a reset while a call waits on the check makes that call check again before acting', async () => {
      let release!: () => void;
      const held = new Promise<void>(r => (release = r));
      let probes = 0;
      const { computer, steps } = setup(undefined, undefined, 'builder', {
        probe: async () => {
          probes += 1;
          if (probes === 1) await held;
          return { exitCode: 0, stdout: '{"ok": true, "generation": "0123456789abcdef"}\n' };
        },
      });
      const click = computer.leftClick(1, 1);
      await vi.waitFor(() => expect(probes).toBe(1));
      computer.resetReadiness();
      release();
      await click;
      expect(steps().filter(s => s === 'capability')).toHaveLength(2);
      expect(steps().indexOf('work')).toBeGreaterThan(steps().lastIndexOf('capability'));
    });

    it.each([
      [2, /desktop check failed \(exit 2\): boom/],
      [127, /desktop check failed \(exit 127\): boom/],
    ])('a capability check exiting %i is reported as such, not blamed on the template', async (code, message) => {
      const { computer } = setup(undefined, undefined, 'builder', {
        capability: () => ({ exitCode: code, stderr: 'boom\n' }),
      });
      const error = await computer.moveMouse(1, 1).then(
        () => undefined,
        (e: Error) => e,
      );
      expect(error?.message).toMatch(message);
      expect(error?.message).not.toContain('.desktop()');
    });

    it('resetReadiness makes the next call check the desktop again', async () => {
      const { computer, checks } = setup();
      await computer.moveMouse(1, 1);
      computer.resetReadiness();
      await computer.moveMouse(1, 1);
      expect(checks()).toBe(2);
    });

    it.each([
      ['unit', /mastra-desktop service is not running/],
      ['display', /X display :1 does not answer/],
      ['viewer', /noVNC viewer on port 6080 does not answer/],
      ['accessibility', /accessibility helper cannot reach the desktop/],
    ])('a failed %s probe names it', async (probe, message) => {
      const { computer } = setup(undefined, undefined, 'builder', {
        probe: () => ({ exitCode: 1, stderr: `probe=${probe}\n` }),
      });
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(message);
    });

    it('a timed-out probe says so', async () => {
      const { computer } = setup(undefined, undefined, 'builder', {
        probe: () => ({ exitCode: 124, timedOut: true, stderr: '' }),
      });
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(/probes timed out after 10s/);
    });

    it.each([
      ['capability', { exitCode: 3, stderr: '' }, ['capability', 'hash', 'upload', 'probe', 'work']],
      ['upload', { exitCode: 1, stderr: 'disk full' }, ['capability', 'hash', 'upload', 'probe', 'work']],
      ['probe', { exitCode: 1, stderr: 'probe=display' }, ['capability', 'hash', 'probe', 'work']],
      ['probe', { exitCode: 0, stdout: 'no json\n', stderr: '' }, ['capability', 'hash', 'probe', 'work']],
    ] as const)(
      'a rejection at %s clears the check, so the next call runs every stage again',
      async (step, reply, again) => {
        let fail = true;
        const { computer, steps, calls } = setup(undefined, undefined, 'builder', {
          [step]: async (call: Call) => {
            if (fail) {
              fail = false;
              return reply;
            }
            return await fakeDesktop().exec(call.command, call.args, call.opts);
          },
        });
        await expect(computer.moveMouse(1, 1)).rejects.toThrow();
        const firstAttempt = calls.length;
        await computer.moveMouse(1, 1);
        expect(steps().slice(firstAttempt)).toEqual(again);
      },
    );

    it('pixel calls are generation-free: a desktop restart between calls needs no new check', async () => {
      const { computer, desktop, checks } = setup();
      await computer.moveMouse(1, 1);
      desktop.generation = 'fedcba9876543210';
      await computer.moveMouse(2, 2);
      expect(checks()).toBe(1);
    });

    it('a timed-out pixel call clears the check', async () => {
      let slow = true;
      const { computer, checks } = setup(() => {
        if (slow) {
          slow = false;
          return { exitCode: 124, timedOut: true, stderr: '' };
        }
        return ok();
      });
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(/timed out/);
      await computer.moveMouse(1, 1);
      expect(checks()).toBe(2);
    });

    it('the upload script writes the exact helper bytes, private, through a real shell', async () => {
      const { execFile } = await import('node:child_process');
      const { mkdtemp, readFile, stat, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { ACCESSIBILITY_HELPER } = await import('./computer-accessibility.js');
      const { exec, calls } = fakeDesktop();
      await createPlatformComputer({ exec, viewerUrl: async () => null, template: 'builder' }).moveMouse(1, 1);
      const args = calls.find(c => c.args?.[1] === UPLOAD_SCRIPT)!.args!;
      const dir = await mkdtemp(join(tmpdir(), 'a11y-upload-'));
      try {
        const target = join(dir, 'a11y.py');
        await new Promise<void>((resolve, reject) =>
          execFile('bash', [args[0]!, args[1]!, args[2]!, target, args[4]!], err => (err ? reject(err) : resolve())),
        );
        expect(await readFile(target, 'utf8')).toBe(ACCESSIBILITY_HELPER);
        expect((await stat(target)).mode & 0o777).toBe(0o600);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe('queue', () => {
    function queued(delays: Record<string, number>, failOn?: string) {
      let inFlight = 0;
      let maxInFlight = 0;
      const order: string[] = [];
      const fake = fakeDesktop(async ({ command, args }: Call) => {
        const name = command === 'xdotool' ? args!.join(' ') : 'screenshot';
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(delays[name] ?? 0);
        inFlight--;
        order.push(name);
        if (name === failOn) return result({ exitCode: 1, stderr: 'nope' });
        if (name === 'getdisplaygeometry') return result(ok('1280 800'));
        if (name === 'screenshot') return result(screenshotOut(png()));
        return result(ok());
      });
      const computer = createPlatformComputer({
        exec: fake.exec,
        viewerUrl: async () => {
          order.push('streamUrl');
          return null;
        },
        template: 'builder',
      });
      return { computer, order, maxInFlight: () => maxInFlight };
    }

    it('runs calls in submission order without overlap', async () => {
      const { computer, order, maxInFlight } = queued({ 'mousemove 1 1': 30, 'mousemove 2 2': 15, 'mousemove 3 3': 0 });
      await Promise.all([computer.moveMouse(1, 1), computer.moveMouse(2, 2), computer.moveMouse(3, 3)]);
      expect(order).toEqual(['mousemove 1 1', 'mousemove 2 2', 'mousemove 3 3']);
      expect(maxInFlight()).toBe(1);
    });

    it('a rejected call does not wedge the next one', async () => {
      const { computer, order } = queued({ 'mousemove 1 1': 10 }, 'mousemove 1 1');
      const first = computer.moveMouse(1, 1);
      const second = computer.moveMouse(2, 2);
      await expect(first).rejects.toThrow(/nope/);
      await expect(second).resolves.toBeUndefined();
      expect(order).toEqual(['mousemove 1 1', 'mousemove 2 2']);
    });

    it('orders heterogeneous calls, including streamUrl', async () => {
      const { computer, order, maxInFlight } = queued({ screenshot: 20, getdisplaygeometry: 10 });
      await Promise.all([computer.screenshot(), computer.type('hi'), computer.getScreenSize(), computer.streamUrl!()]);
      expect(order).toEqual([
        'screenshot',
        'type --clearmodifiers --delay 12 -- hi',
        'getdisplaygeometry',
        'streamUrl',
      ]);
      expect(maxInFlight()).toBe(1);
    });

    it('streamUrl as the first call still checks the desktop first', async () => {
      const seen: string[] = [];
      const fake = fakeDesktop();
      const computer = createPlatformComputer({
        exec: async (command, args, opts) => {
          seen.push(command);
          return fake.exec(command, args, opts);
        },
        viewerUrl: async () => {
          seen.push('viewer');
          return 'https://v/';
        },
        template: 'builder',
      });
      await expect(computer.streamUrl!()).resolves.toBe('https://v/');
      expect(seen).toEqual(['bash', 'sha256sum', 'bash', 'bash', 'viewer']);
    });
  });
});
