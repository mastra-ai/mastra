import { AccessibilityRefError } from '@mastra/core/workspace';
import type { CommandResult } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { ACCESSIBILITY_HELPER, accessibilityHelperFile, DESKTOP_ENV } from './computer-accessibility.js';
import { createPlatformComputer } from './computer.js';
import { fakeDesktop, readinessStep, result } from './computer.test-fixtures.js';
import type { Call } from './computer.test-fixtures.js';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const reply = (body: unknown): Partial<CommandResult> => ({ exitCode: 0, stdout: `${JSON.stringify(body)}\n` });

const TREE = {
  ok: true,
  snapshotId: '0123456789abcdef',
  truncated: false,
  nodes: [
    {
      ref: 'aaaaaaaaaaaaaaaa.0123456789abcdef.0',
      role: 'push button',
      name: 'OK',
      states: [],
      actions: ['click'],
      depth: 0,
    },
  ],
};

const isHelper = (c: Call) => c.command === '/usr/bin/python3';
const request = (c: Call) => JSON.parse(c.args![1]!) as Record<string, unknown>;

/** A computer whose helper calls get `respond`, with an optional per-op delay; `order` records completions. */
function setup(
  respond: (req: Record<string, unknown>) => Partial<CommandResult> | Promise<Partial<CommandResult>> = () =>
    reply({ ok: true }),
  delays: Record<string, number> = {},
) {
  const order: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fake = fakeDesktop(async call => {
    const { command, args } = call;
    const name = isHelper(call) ? String(request(call).op) : command === 'xdotool' ? args![0]! : 'screenshot';
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await delay(delays[name] ?? 0);
      if (isHelper(call)) return result(await respond(request(call)));
      if (name === 'screenshot') return result({ exitCode: 1, stderr: 'no screen in tests' });
      return result({});
    } finally {
      inFlight--;
      order.push(name);
    }
  });
  const computer = createPlatformComputer({ exec: fake.exec, viewerUrl: async () => null, template: 'builder' });
  return {
    accessibility: computer.accessibility!,
    computer,
    calls: fake.calls,
    desktop: fake.desktop,
    steps: fake.steps,
    order,
    helperCalls: () => fake.calls.filter(isHelper),
    checks: fake.checks,
    uploads: fake.uploads,
    maxInFlight: () => maxInFlight,
  };
}

describe('PlatformSandbox computer accessibility', () => {
  describe('helper exec', () => {
    it('runs the fixed helper with one JSON argument, tree replayable with a 20 s timeout', async () => {
      const { accessibility, helperCalls } = setup(() => reply(TREE));
      await expect(accessibility.getTree({ app: 'gedit', maxDepth: 3, maxNodes: 50 })).resolves.toEqual({
        snapshotId: TREE.snapshotId,
        nodes: TREE.nodes,
        truncated: false,
      });
      expect(helperCalls()).toEqual([
        {
          command: '/usr/bin/python3',
          args: [
            accessibilityHelperFile().path,
            JSON.stringify({ op: 'tree', app: 'gedit', maxDepth: 3, maxNodes: 50 }),
          ],
          opts: { once: false, timeout: 20_000, env: { ...DESKTOP_ENV } },
        },
      ]);
    });

    it('fills the tree bounds when the caller leaves them out', async () => {
      const { accessibility, helperCalls } = setup(() => reply(TREE));
      await accessibility.getTree();
      expect(request(helperCalls()[0]!)).toEqual({ op: 'tree', maxDepth: 25, maxNodes: 400 });
    });

    it('sends act and setText once, with a 10 s timeout', async () => {
      const { accessibility, helperCalls } = setup();
      await accessibility.act('g.s.1', 'click');
      await accessibility.setText('g.s.2', 'hi');
      expect(helperCalls().map(c => [c.args, c.opts])).toEqual([
        [
          [accessibilityHelperFile().path, JSON.stringify({ op: 'act', ref: 'g.s.1', action: 'click' })],
          { once: true, timeout: 10_000, env: { ...DESKTOP_ENV } },
        ],
        [
          [accessibilityHelperFile().path, JSON.stringify({ op: 'setText', ref: 'g.s.2', text: 'hi' })],
          { once: true, timeout: 10_000, env: { ...DESKTOP_ENV } },
        ],
      ]);
    });
  });

  describe('errors', () => {
    it('turns a stale-ref reply into an AccessibilityRefError with its reason', async () => {
      const { accessibility } = setup(() =>
        reply({
          ok: false,
          error: 'ref',
          ref: 'g.s.1',
          reason: 'gone',
          message: 'Accessibility ref g.s.1 no longer exists',
        }),
      );
      const err = await accessibility.act('g.s.1', 'click').catch(e => e);
      expect(err).toBeInstanceOf(AccessibilityRefError);
      expect(err).toMatchObject({ ref: 'g.s.1', reason: 'gone', message: 'Accessibility ref g.s.1 no longer exists' });
    });

    it('keeps a reply with an unknown reason an ordinary error', async () => {
      const { accessibility } = setup(() => reply({ ok: false, error: 'ref', ref: 'g.s.1', reason: 'stolen' }));
      const err = await accessibility.act('g.s.1', 'click').catch(e => e);
      expect(err).not.toBeInstanceOf(AccessibilityRefError);
      expect(err.message).toMatch(/computer accessibility act failed \(ref\)/);
    });

    it('surfaces a helper error reply with its code and message', async () => {
      const { accessibility } = setup(() =>
        reply({ ok: false, error: 'unknown-action', message: 'node supports actions: click', actions: ['click'] }),
      );
      await expect(accessibility.act('g.s.1', 'explode')).rejects.toThrow(
        'computer accessibility act failed (unknown-action): node supports actions: click',
      );
    });

    it('reports a helper that printed no JSON with its stderr', async () => {
      const { accessibility } = setup(() => ({ exitCode: 1, stdout: '', stderr: 'Traceback\nImportError: gi' }));
      await expect(accessibility.getTree()).rejects.toThrow(/tree failed \(exit 1\): Traceback\nImportError: gi/);
    });

    it('names the operation on a timeout, and says the outcome of an action is unknown', async () => {
      const { accessibility } = setup(req => ({
        exitCode: null as unknown as number,
        timedOut: true,
        stdout: String(req.op),
      }));
      await expect(accessibility.getTree()).rejects.toThrow('computer accessibility tree timed out after 20s');
      await expect(accessibility.act('g.s.1', 'click')).rejects.toThrow(
        'computer accessibility act timed out after 10s, so the outcome is unknown; read the tree again before retrying',
      );
    });

    it('a failed once action says the outcome is unknown and does not block the next queued call', async () => {
      let first = true;
      const { accessibility, computer, order } = setup(async () => {
        if (first) {
          first = false;
          throw new Error('socket hang up');
        }
        return reply({ ok: true });
      });
      const act = accessibility.act('g.s.1', 'click');
      const click = computer.leftClick(1, 2);
      await expect(act).rejects.toThrow(
        /act: the command channel failed, so the outcome is unknown; read the tree again before retrying \(socket hang up\)/,
      );
      await expect(click).resolves.toBeUndefined();
      expect(order).toEqual(['act', 'mousemove']);
    });

    it('re-checks the desktop after a transport failure', async () => {
      let first = true;
      const { accessibility, checks } = setup(async () => {
        if (first) {
          first = false;
          throw new Error('socket hang up');
        }
        return reply(TREE);
      });
      await expect(accessibility.getTree()).rejects.toThrow('socket hang up');
      await accessibility.getTree();
      expect(checks()).toBe(2);
    });
  });

  describe('queue', () => {
    it('a slow tree finishes before a later leftClick starts', async () => {
      const { accessibility, computer, order, maxInFlight } = setup(() => reply(TREE), { tree: 30 });
      await Promise.all([accessibility.getTree(), computer.leftClick(1, 1)]);
      expect(order).toEqual(['tree', 'mousemove']);
      expect(maxInFlight()).toBe(1);
    });

    it('a slow screenshot finishes before a later act starts', async () => {
      const { accessibility, computer, order, maxInFlight } = setup(() => reply({ ok: true }), { screenshot: 30 });
      await Promise.all([computer.screenshot().catch(() => undefined), accessibility.act('g.s.1', 'click')]);
      expect(order).toEqual(['screenshot', 'act']);
      expect(maxInFlight()).toBe(1);
    });

    it('accessibility calls check the desktop first, sharing one check with pixel calls', async () => {
      const { accessibility, computer, calls, checks } = setup(() => reply(TREE));
      await Promise.all([accessibility.getTree(), computer.moveMouse(1, 1), accessibility.act('g.s.1', 'click')]);
      expect(readinessStep(calls[0]!)).toBe('capability');
      expect(checks()).toBe(1);
    });
  });

  describe('readiness', () => {
    it('a pixel-first call uploads the helper before its health ping', async () => {
      const { computer, steps, uploads } = setup();
      await computer.moveMouse(1, 1);
      expect(steps()).toEqual(['capability', 'hash', 'upload', 'probe', 'work']);
      expect(Buffer.from(uploads()[0]!.args![4]!, 'base64').toString('utf8')).toBe(ACCESSIBILITY_HELPER);
    });

    it('a tree from another desktop generation clears the check', async () => {
      const { accessibility, checks } = setup(() => reply({ ...TREE, generation: 'fedcba9876543210' }));
      await accessibility.getTree();
      await accessibility.getTree();
      expect(checks()).toBe(2);
    });

    it('a tree from the same generation keeps the check', async () => {
      const { accessibility, desktop, checks } = setup(() => reply({ ...TREE, generation: desktop.generation }));
      await accessibility.getTree();
      await accessibility.getTree();
      expect(checks()).toBe(1);
    });

    it('a helper file gone from disk is uploaded again on the next call', async () => {
      let gone = false;
      const { accessibility, desktop, uploads } = setup(() => {
        if (gone) {
          gone = false;
          desktop.helper = undefined;
          return { exitCode: 2, stderr: "/usr/bin/python3: can't open file: [Errno 2] No such file or directory" };
        }
        return reply(TREE);
      });
      await accessibility.getTree();
      gone = true;
      await expect(accessibility.getTree()).rejects.toThrow(/No such file or directory/);
      await accessibility.getTree();
      expect(uploads()).toHaveLength(2);
    });
  });

  describe('bundled helper', () => {
    it('is the exact text of computer-accessibility-helper.py, at a path named by its SHA-256', async () => {
      const { readFile } = await import('node:fs/promises');
      const { createHash } = await import('node:crypto');
      const source = await readFile(new URL('./computer-accessibility-helper.py', import.meta.url), 'utf8');
      expect(ACCESSIBILITY_HELPER).toBe(source);
      expect(accessibilityHelperFile().path).toBe(
        `/tmp/.mastra-desktop/a11y-${createHash('sha256').update(source).digest('hex')}.py`,
      );
    });
  });

  describe('helper text', () => {
    it('checks the refusal reasons in the documented order', () => {
      const at = (needle: string) => {
        const i = ACCESSIBILITY_HELPER.indexOf(needle);
        expect(i, needle).toBeGreaterThan(-1);
        return i;
      };
      const order = [
        at("refuse(str(ref), 'malformed'"),
        at("refuse(ref, 'generation'"),
        at("refuse(ref, 'snapshot-missing'"),
        at('names no node in its snapshot'),
        at('was not found within 2,000 nodes'),
        at("refuse(ref, 'changed'"),
      ];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('resolves by bus name and object path and keeps the newest 32 snapshots', () => {
      expect(ACCESSIBILITY_HELPER).toContain("if acc.path == record['path']:");
      expect(ACCESSIBILITY_HELPER).toContain("if candidate.app.bus_name == record['bus']:");
      expect(ACCESSIBILITY_HELPER).toContain('KEEP = 32');
      expect(ACCESSIBILITY_HELPER).toContain('RESOLVE_CAP = 2000');
    });
  });
});
