/**
 * Live proof of the computer desktop on a staging E2B sandbox. Skips unless
 * MASTRA_COMPUTER_STAGING=1; with the flag set, missing credentials fail.
 *
 * Credentials come from the 0600 JSON file named by
 * MASTRA_COMPUTER_STAGING_CREDS ({ accessToken, projectId }); the GTK test app
 * from MASTRA_COMPUTER_DESK_APP. Every secret the
 * test receives is appended, with its URL-encoded form, to SECRET_PATTERNS_FILE
 * for the caller's leak scan. Nothing here logs commands, URLs or env.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';

import type { AccessibilityNode } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESSIBILITY_HELPER_PATH } from './computer-accessibility.js';
import { PlatformSandbox } from './sandbox.js';
import { Template } from './template.js';

const STAGING = process.env.MASTRA_COMPUTER_STAGING === '1';
const PLATFORM_URL = 'https://platform.staging.mastra.ai';
const TREE_MISSING = 'desk app missing from the accessibility tree';

const log = (msg: string) => console.log(`[computer-staging] ${msg}`);
/** Sandbox ids in logs only as 16-hex SHA-256 prefixes. */
const hashIds = (text: string) =>
  text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, id =>
    createHash('sha256').update(id).digest('hex').slice(0, 16),
  );
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function recordSecret(value: string | undefined) {
  const file = process.env.SECRET_PATTERNS_FILE;
  if (!file || !value || /[\r\n]/.test(value)) return;
  appendFileSync(file, `${value}\n${encodeURIComponent(value)}\n`);
}

function readCredentials(): { accessToken: string; projectId: string } {
  const file = process.env.MASTRA_COMPUTER_STAGING_CREDS;
  if (!file) throw new Error('MASTRA_COMPUTER_STAGING=1 but MASTRA_COMPUTER_STAGING_CREDS is not set');
  const creds = JSON.parse(readFileSync(file, 'utf8')) as { accessToken?: string; projectId?: string };
  if (!creds.accessToken || !creds.projectId) throw new Error('staging credentials file lacks accessToken/projectId');
  recordSecret(creds.accessToken);
  return { accessToken: creds.accessToken, projectId: creds.projectId };
}

async function discoverEnvironment(accessToken: string, projectId: string): Promise<string> {
  const response = await fetch(`${PLATFORM_URL}/v1/projects/${encodeURIComponent(projectId)}/environments`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`environment discovery failed: HTTP ${response.status}`);
  const body = (await response.json()) as { environments?: Array<{ id: string }>; data?: Array<{ id: string }> };
  const id = (body.environments ?? body.data ?? [])[0]?.id;
  if (!id) throw new Error('no environment on the staging project');
  return id;
}

/** The GTK test app (entry, "Press me", status label), named by MASTRA_COMPUTER_DESK_APP. */
function readDeskApp(): string {
  const file = process.env.MASTRA_COMPUTER_DESK_APP;
  if (!file) throw new Error('MASTRA_COMPUTER_STAGING=1 but MASTRA_COMPUTER_DESK_APP is not set');
  return readFileSync(file, 'utf8');
}

const centre = (node: AccessibilityNode) => ({
  x: Math.round(node.bounds!.x + node.bounds!.width / 2),
  y: Math.round(node.bounds!.y + node.bounds!.height / 2),
});

describe.skipIf(!STAGING)('PlatformSandbox computer on staging', () => {
  beforeEach(() => vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it(
    'runs the desktop, its accessibility tree, pixels and viewer on a real sandbox',
    { timeout: 900_000 },
    async () => {
      const { accessToken, projectId } = readCredentials();
      process.env.MASTRA_WORKSPACE_PROXY_URL ??= 'https://workspaces.staging.mastra.ai';
      const environmentId = await discoverEnvironment(accessToken, projectId);
      const options = { accessToken, projectId, environmentId, sandboxProvider: 'e2b' as const };
      // GTK is for the test app only; the desktop itself never needs it.
      const template = Template().desktop().aptInstall(['gir1.2-gtk-3.0']);
      const sandbox = new PlatformSandbox({ ...options, template, computer: true, idleTimeoutMinutes: 15 });
      const sh = async (script: string, timeout = 60_000) => {
        const result = await sandbox.executeCommand('bash', ['-c', script], { timeout });
        return { ...result, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
      };

      try {
        const started = Date.now();
        await sandbox.start();
        log(`start() elapsed ${Date.now() - started} ms`);

        // The image booted the desktop; the first computer call checks it and uploads the helper.
        const screen = await sandbox.computer!.getScreenSize();
        log(`screen ${screen.width}x${screen.height}`);
        const health = await sh(
          `systemctl is-active mastra-desktop && xdpyinfo -display :1 >/dev/null && echo x=ok; /usr/bin/python3 ${ACCESSIBILITY_HELPER_PATH} '{"op":"ping"}'`,
        );
        expect(health.stdout).toContain('x=ok');
        expect(health.stdout).toContain('"ok": true');
        const dir = await sh(`stat -c '%u %a' /tmp/.mastra-desktop; id -u`);
        const [owner, mode, uid] = dir.stdout.trim().split(/\s+/);
        expect({ owner, mode }).toEqual({ owner: uid, mode: '700' });
        log('desk healthy after start(); /tmp/.mastra-desktop owned by id -u, mode 0700');

        await sandbox.filesystem!.writeFile('/tmp/desk-app.py', readDeskApp());
        // The agent's path: a background spawn with no extra env.
        await sandbox.processes!.spawn('/usr/bin/python3 /tmp/desk-app.py');
        log('desk app started with a background spawn, no extra env');

        const a11y = sandbox.computer!.accessibility!;
        const readTree = async () => {
          const deadline = Date.now() + 45_000;
          let last = '';
          while (Date.now() < deadline) {
            try {
              const snapshot = await a11y.getTree({ app: 'desk-app.py' });
              const label = snapshot.nodes.find(n => n.role === 'label' && n.name.startsWith('clicks:'));
              const button = snapshot.nodes.find(n => n.role === 'push button' && n.name === 'Press me');
              const entry = snapshot.nodes.find(n => n.role === 'text');
              if (label && button && entry) return { snapshot, label, button, entry };
              last = `${snapshot.nodes.length} nodes`;
            } catch (error) {
              last = error instanceof Error ? error.message.slice(0, 120) : 'error';
            }
            await sleep(1_000);
          }
          throw new Error(`${TREE_MISSING} (last: ${last})`);
        };

        let tree = await readTree();
        log(`tree lists the desk app: ${tree.snapshot.nodes.length} nodes`);
        await a11y.setText(tree.entry.ref, 'hello desktop');
        await a11y.act(tree.button.ref, 'click');
        tree = await readTree();
        expect(tree.label.name.startsWith('clicks: 1 text=hello desktop ')).toBe(true);
        log('setText + act through accessibility: label "clicks: 1 text=hello desktop ..."');

        const shot = await sandbox.computer!.screenshot();
        expect(Buffer.from(shot.data).subarray(1, 4).toString()).toBe('PNG');
        log(`screenshot() returned a PNG of ${shot.data.length} bytes`);

        let point = centre(tree.button);
        await sandbox.computer!.leftClick(point.x, point.y);
        await sleep(500);
        tree = await readTree();
        expect(tree.label.name.startsWith('clicks: 2 ')).toBe(true);
        log('leftClick at the AT-SPI bounds bumped the counter to 2');

        const before = { ...tree.button.bounds! };
        const moved = await sh(`xdotool search --name '^Desk$' | head -1 | xargs -I{} xdotool windowmove {} 400 300`);
        expect(moved.exitCode).toBe(0);
        await sleep(800);
        tree = await readTree();
        expect({ x: tree.button.bounds!.x, y: tree.button.bounds!.y }).not.toEqual({ x: before.x, y: before.y });
        point = centre(tree.button);
        await sandbox.computer!.leftClick(point.x, point.y);
        await sleep(500);
        tree = await readTree();
        expect(tree.label.name.startsWith('clicks: 3 ')).toBe(true);
        log('window moved, new bounds read, click at the new centre bumped the counter to 3');

        // Viewer. The Mac can't reach preview hosts, so curl runs inside the
        // sandbox against the public preview URL; the cookie goes in a 0600 file.
        const streamUrl = await sandbox.computer!.streamUrl!();
        expect(streamUrl).toBeTruthy();
        const viewer = new URL(streamUrl!);
        const cookie = await sandbox.getPortAuthCookie(6080);
        expect(cookie).toBeTruthy();
        recordSecret(cookie!.value);
        log(`viewer host ${hashIds(viewer.host)}`);
        // The files API and exec may run as different users: the files user makes
        // the directory, exec locks it to 0700, then the cookie goes inside.
        const cookieDir = '/tmp/.viewer-cookie';
        const cookieFile = `${cookieDir}/header`;
        await sandbox.filesystem!.mkdir(cookieDir);
        await sh(`chmod 700 ${cookieDir}`);
        await sandbox.filesystem!.writeFile(cookieFile, `Cookie: ${cookie!.name}=${cookie!.value}\n`);
        const perm = await sh(`chmod 600 ${cookieFile}; stat -c %a ${cookieDir} ${cookieFile}`);
        expect(perm.stdout.trim().split(/\s+/)).toEqual(['700', '600']);
        try {
          const pageUrl = `${viewer.origin}${viewer.pathname}`;
          const wsUrl = `${viewer.origin}/websockify`;
          const page = (withCookie: boolean) =>
            sandbox.executeCommand(
              'curl',
              [
                '-s',
                '-o',
                '/dev/null',
                '-w',
                '%{http_code}',
                '--max-time',
                '20',
                ...(withCookie ? ['-H', `@${cookieFile}`] : []),
                pageUrl,
              ],
              { timeout: 30_000 },
            );
          const upgrade = (withCookie: boolean) =>
            sandbox.executeCommand(
              'curl',
              [
                '-s',
                '-o',
                '/dev/null',
                '-w',
                '%{http_code}',
                '--http1.1',
                '--max-time',
                '8',
                '-H',
                'Connection: Upgrade',
                '-H',
                'Upgrade: websocket',
                '-H',
                'Sec-WebSocket-Version: 13',
                '-H',
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
                '-H',
                'Sec-WebSocket-Protocol: binary',
                ...(withCookie ? ['-H', `@${cookieFile}`] : []),
                wsUrl,
              ],
              { timeout: 30_000 },
            );
          const pageWith = (await page(true)).stdout.trim();
          const pageWithout = (await page(false)).stdout.trim();
          const wsWith = (await upgrade(true)).stdout.trim();
          const wsWithout = (await upgrade(false)).stdout.trim();
          log(`viewer page with cookie ${pageWith}, without ${pageWithout}`);
          log(`viewer websocket with cookie ${wsWith}, without ${wsWithout}`);
          expect(pageWith).toBe('200');
          expect(pageWithout).toBe('401');
          expect(wsWith).toBe('101');
          expect(wsWithout).not.toBe('101');
        } finally {
          await sh(`rm -rf ${cookieDir}`);
        }

        // The desktop env comes from sandbox creation, so it must survive stop()/start() and a reattach.
        const ENV_ECHO = 'echo "$DISPLAY|$DBUS_SESSION_BUS_ADDRESS|$QT_LINUX_ACCESSIBILITY_ALWAYS_ON"';
        const DESKTOP = ':1|unix:path=/tmp/.mastra-desktop/bus|1';
        await sandbox.stop();
        await sandbox.start();
        expect((await sh(ENV_ECHO)).stdout.trim()).toBe(DESKTOP);
        const again = new PlatformSandbox({
          ...options,
          template,
          computer: true,
          sandboxId: sandbox.sandboxId,
          reattach: 'required',
        });
        await again.start();
        const viaExec = await again.executeCommand('bash', ['-c', ENV_ECHO], { timeout: 30_000 });
        expect((viaExec.stdout ?? '').trim()).toBe(DESKTOP);
        await again.processes!.spawn(`bash -c '${ENV_ECHO} > /tmp/spawn-env.txt'`);
        let spawned = '';
        for (let i = 0; i < 20 && !spawned; i++) {
          await sleep(500);
          spawned = ((await sh('cat /tmp/spawn-env.txt 2>/dev/null')).stdout ?? '').trim();
        }
        expect(spawned).toBe(DESKTOP);
        expect((await again.computer!.accessibility!.getTree({ app: 'desk-app.py' })).nodes.length).toBeGreaterThan(0);
        log('desktop env on exec and spawn after stop()/start() and after a reattach; tree still reads');
      } finally {
        const sandboxId = sandbox.sandboxId;
        if (sandboxId) log(`sandbox ${hashIds(sandboxId)}`);
        await sandbox.destroy();
        log('destroy() called');
        if (sandboxId) {
          const deadline = Date.now() + 30_000;
          let gone = false;
          while (!gone && Date.now() < deadline) {
            const again = new PlatformSandbox({ ...options, sandboxId, reattach: 'required' });
            try {
              await again.start();
              await again.executeCommand('true', [], { timeout: 10_000 });
              await sleep(2_000);
            } catch {
              gone = true;
            }
          }
          log(gone ? 'post-destroy exec fails' : 'post-destroy exec still succeeds after 30 s');
          expect(gone).toBe(true);
        }
      }
    },
  );
});
