import type { CommandResult } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import type { ComputerExecOptions } from './computer.js';
import { createComputer, DESKTOP_PACKAGES, ENSURE_SCRIPT, SCREENSHOT_SCRIPT } from './computer.js';

interface Call {
  command: string;
  args: string[] | undefined;
  opts: ComputerExecOptions;
}

type Responder = (call: Call) => Partial<CommandResult> | Promise<Partial<CommandResult>>;

const ok = (stdout = ''): Partial<CommandResult> => ({ exitCode: 0, stdout, stderr: '' });

function result(partial: Partial<CommandResult>): CommandResult {
  const exitCode = partial.exitCode ?? 0;
  return { success: exitCode === 0, exitCode, stdout: '', stderr: '', executionTimeMs: 1, ...partial };
}

const isEnsure = (c: Call) => c.command === 'bash' && c.args?.[1] === ENSURE_SCRIPT;

function setup(respond: Responder = () => ok(), viewer: () => Promise<string | null> = async () => 'https://v/') {
  const calls: Call[] = [];
  const exec = async (command: string, args: string[] | undefined, opts: ComputerExecOptions) => {
    const call = { command, args, opts };
    calls.push(call);
    if (isEnsure(call)) return result(ok('launched=5\nready\n'));
    return result(await respond(call));
  };
  const computer = createComputer({ exec, viewerUrl: viewer });
  return { computer, calls, work: () => calls.filter(c => !isEnsure(c)), ensures: () => calls.filter(isEnsure).length };
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

describe('createComputer', () => {
  describe('command mapping', () => {
    const input = { once: true, timeout: 30_000, env: { DISPLAY: ':1' } };
    const read = { once: false, timeout: 30_000, env: { DISPLAY: ':1' } };

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

    it("re-runs ensure after Can't open display", async () => {
      let fail = true;
      const { computer, ensures } = setup(() => {
        if (fail) {
          fail = false;
          return { exitCode: 1, stderr: "Can't open display: (null)\nFailed creating new xdo instance" };
        }
        return ok();
      });
      await expect(computer.moveMouse(1, 1)).rejects.toThrow(/Can't open display/);
      expect(ensures()).toBe(1);
      await computer.moveMouse(1, 1);
      expect(ensures()).toBe(2);
    });

    it('re-runs ensure after a failed screenshot (scrot words the display error differently)', async () => {
      let fail = true;
      const bytes = png();
      const { computer, ensures } = setup(() => {
        if (fail) {
          fail = false;
          return { exitCode: 1, stderr: "giblib error: Can't open X display. It *is* running, yeah?" };
        }
        return screenshotOut(bytes);
      });
      await expect(computer.screenshot()).rejects.toThrow(/Can't open X display/);
      await expect(computer.screenshot()).resolves.toMatchObject({ mediaType: 'image/png' });
      expect(ensures()).toBe(2);
    });
  });

  describe('desktop lifecycle', () => {
    function lifecycle(ensureResults: Partial<CommandResult>[]) {
      const calls: Call[] = [];
      let ensures = 0;
      const computer = createComputer({
        exec: async (command, args, opts) => {
          calls.push({ command, args, opts });
          if (command === 'bash') return result(ensureResults[ensures++] ?? ok('launched=0\nready\n'));
          return result(ok('1280 800'));
        },
        viewerUrl: async () => null,
      });
      return { computer, calls, ensureCount: () => ensures };
    }

    it('runs the ensure script once, first, with a long timeout', async () => {
      const { computer, calls } = lifecycle([]);
      await computer.getScreenSize();
      await computer.moveMouse(1, 1);
      expect(calls[0]).toEqual({
        command: 'bash',
        args: ['-c', ENSURE_SCRIPT],
        opts: { once: false, timeout: 300_000, env: { DISPLAY: ':1' } },
      });
      expect(calls.filter(c => c.command === 'bash')).toHaveLength(1);
    });

    it('5 concurrent calls run 1 ensure', async () => {
      const { computer, ensureCount } = lifecycle([]);
      await Promise.all([
        computer.getScreenSize(),
        computer.moveMouse(1, 1),
        computer.leftClick(2, 2),
        computer.type('a'),
        computer.press('Enter'),
      ]);
      expect(ensureCount()).toBe(1);
    });

    it('a failed ensure is retried by the next call', async () => {
      const { computer, ensureCount, calls } = lifecycle([{ exitCode: 1, stderr: 'desktop not ready: x_ok' }]);
      await expect(computer.getScreenSize()).rejects.toThrow(/desktop start failed.*x_ok/);
      expect(calls.filter(c => c.command === 'xdotool')).toHaveLength(0);
      await expect(computer.getScreenSize()).resolves.toEqual({ width: 1280, height: 800 });
      expect(ensureCount()).toBe(2);
    });

    it('an ensure without ready fails and is retried', async () => {
      const { computer, ensureCount } = lifecycle([ok('launched=1\n')]);
      await expect(computer.getScreenSize()).rejects.toThrow(/did not report ready/);
      await computer.getScreenSize();
      expect(ensureCount()).toBe(2);
    });

    it('the ensure script locks, closes the lock fd in every daemon, and uses functional guards', () => {
      expect(ENSURE_SCRIPT).toContain('flock -w 120 9');
      const setsidLines = ENSURE_SCRIPT.split('\n').filter(l => l.includes('setsid'));
      expect(setsidLines.length).toBeGreaterThan(0);
      for (const line of setsidLines) expect(line).toContain('9>&-');
      for (const guard of [
        'xdpyinfo -display :1',
        'xprop -display :1 -root _NET_SUPPORTING_WM_CHECK',
        'xprop -display :1 -id "$wm" _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q "window id # $wm"',
        '[ -f /usr/share/novnc/vnc.html ] || missing=1',
        '0.0.0.0:6080 127.0.0.1:5900',
        "bash -c '</dev/tcp/127.0.0.1/5900'",
        'curl -sf -o /dev/null http://127.0.0.1:6080/vnc.html',
        'xdotool search --class xterm',
      ]) {
        expect(ENSURE_SCRIPT).toContain(guard);
      }
      for (const daemon of ['launch Xvfb', 'launch openbox', 'launch x11vnc', 'launch websockify', 'launch xterm']) {
        expect(ENSURE_SCRIPT).toContain(daemon);
      }
      expect(ENSURE_SCRIPT).not.toContain('pgrep');
      expect(ENSURE_SCRIPT).toContain(`--no-install-recommends ${DESKTOP_PACKAGES.join(' ')}`);
      expect(ENSURE_SCRIPT).toContain('launched=$n" >>/tmp/.mastra-computer-ensure.log');
    });
  });

  describe('queue', () => {
    function queued(delays: Record<string, number>, failOn?: string) {
      let inFlight = 0;
      let maxInFlight = 0;
      const order: string[] = [];
      const computer = createComputer({
        exec: async (command, args) => {
          if (command === 'bash') return result(ok('ready'));
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
        },
        viewerUrl: async () => {
          order.push('streamUrl');
          return null;
        },
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

    it('streamUrl as the first call still ensures the desktop first', async () => {
      const seen: string[] = [];
      const computer = createComputer({
        exec: async command => {
          seen.push(command);
          return result(ok('ready'));
        },
        viewerUrl: async () => {
          seen.push('viewer');
          return 'https://v/';
        },
      });
      await expect(computer.streamUrl!()).resolves.toBe('https://v/');
      expect(seen).toEqual(['bash', 'viewer']);
    });
  });
});
