import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterEach } from 'vitest';

/**
 * Real multi-process integration test for PeerBus.
 *
 * Spawns two independent tsx child processes (bob first, then alice) that
 * communicate exclusively over Unix sockets in /tmp/mc/<resourceId>/ — the
 * same transport two real mastracode instances would use. Verifies:
 * - late-joiner discovery via the hello probe (faster than one heartbeat)
 * - direct messaging (alice -> bob inbox)
 * - threaded reply (bob -> alice with replyTo)
 * - broadcast (alice -> bob)
 * - clean shutdown with socket cleanup
 */

const tsxBin = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
const childScript = fileURLToPath(new URL('./fixtures/peer-bus-child.mts', import.meta.url));

type ChildResult = { code: number | null; stdout: string; stderr: string };

function runChild(role: 'alice' | 'bob', resourceId: string): Promise<ChildResult> {
  return new Promise(resolve => {
    const child = spawn(tsxBin, [childScript, role], {
      env: { ...process.env, PEER_TEST_RESOURCE_ID: resourceId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe.skipIf(process.platform === 'win32')('PeerBus (multi-process over Unix sockets)', () => {
  const resourceId = `peer-bus-test-${randomUUID().slice(0, 8)}`;
  const socketDir = `/tmp/mc/${resourceId}`;

  afterEach(() => {
    rmSync(socketDir, { recursive: true, force: true });
  });

  it('discovers peers, exchanges direct/reply/broadcast messages, and cleans up', async () => {
    const bobPromise = runChild('bob', resourceId);
    // Alice joins late: her discovery of bob exercises the hello probe.
    await new Promise(resolve => setTimeout(resolve, 500));
    const alicePromise = runChild('alice', resourceId);

    const [bob, alice] = await Promise.all([bobPromise, alicePromise]);

    expect(alice.stderr).toBe('');
    expect(bob.stderr).toBe('');
    expect(alice.stdout).toContain('alice:discovered-bob');
    expect(bob.stdout).toContain('bob:got-direct');
    expect(alice.stdout).toContain('alice:got-reply');
    expect(bob.stdout).toContain('bob:got-broadcast');
    expect(alice.stdout).toContain('alice:PASS');
    expect(bob.stdout).toContain('bob:PASS');
    expect(alice.code).toBe(0);
    expect(bob.code).toBe(0);

    // Broker sockets must be unlinked after both processes close.
    let leftoverSockets: string[] = [];
    try {
      leftoverSockets = readdirSync(socketDir).filter(name => name.endsWith('.sock'));
    } catch {
      // Directory gone entirely is fine too.
    }
    expect(leftoverSockets).toEqual([]);
  }, 30_000);
});
