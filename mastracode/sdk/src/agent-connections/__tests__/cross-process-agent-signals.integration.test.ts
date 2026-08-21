import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const tsxBin = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
const childScript = fileURLToPath(new URL('./fixtures/cross-process-agent-signals-child.mts', import.meta.url));

type ChildEvent = {
  event: string;
  role: 'owner' | 'sender';
  pid: number;
  [key: string]: unknown;
};

function startChild(role: 'owner' | 'sender', resourceId: string, scenario = 'request-reply') {
  const child = spawn(tsxBin, [childScript, role, resourceId, scenario], { stdio: ['pipe', 'pipe', 'pipe'] });
  const events: ChildEvent[] = [];
  const waiters = new Map<string, Array<(event: ChildEvent) => void>>();
  let stdout = '';
  let stderr = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
    const lines = stdout.split('\n');
    stdout = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line) as ChildEvent;
      events.push(event);
      for (const resolve of waiters.get(event.event) ?? []) resolve(event);
      waiters.delete(event.event);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  return {
    child,
    events,
    get stderr() {
      return stderr;
    },
    waitFor(eventName: string, timeoutMs = 10_000) {
      const existing = events.find(event => event.event === eventName);
      if (existing) return Promise.resolve(existing);
      return new Promise<ChildEvent>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for ${role}:${eventName}. Events: ${JSON.stringify(events)}. stderr: ${stderr}`,
            ),
          );
        }, timeoutMs);
        const resolveWithCleanup = (event: ChildEvent) => {
          clearTimeout(timeout);
          resolve(event);
        };
        waiters.set(eventName, [...(waiters.get(eventName) ?? []), resolveWithCleanup]);
      });
    },
    result: new Promise<number | null>(resolve => child.on('close', resolve)),
  };
}

describe.skipIf(process.platform === 'win32')('cross-agent signals over Unix sockets', () => {
  const resourceId = `agent-signals-${randomUUID().slice(0, 8)}`;
  const socketDir = `/tmp/mc/${resourceId}`;

  afterEach(() => {
    rmSync(socketDir, { recursive: true, force: true });
  });

  it('discovers thread peers and completes a request/reply across processes', async () => {
    const owner = startChild('owner', resourceId);
    await owner.waitFor('thread-owned');

    const sender = startChild('sender', resourceId);
    const senderOwned = await sender.waitFor('thread-owned');
    const senderDiscovery = await sender.waitFor('discovered');
    const ownerRequest = await owner.waitFor('request');
    const ownerDiscovery = await owner.waitFor('discovered');
    const ownerSend = await owner.waitFor('send-result');
    const senderSend = await sender.waitFor('send-result');
    const senderReply = await sender.waitFor('reply');
    await sender.waitFor('pass');

    owner.child.stdin.write('close\n');
    owner.child.stdin.end();
    const [ownerCode, senderCode] = await Promise.all([owner.result, sender.result]);

    expect(owner.child.pid).not.toBe(sender.child.pid);
    expect(senderOwned.threadId).toBe('sender-thread');
    expect(senderDiscovery.peerThreadId).toBe('owner-thread');
    expect(ownerDiscovery.peerThreadId).toBe('sender-thread');
    expect(ownerRequest.text).toBe('owner-response');
    expect(senderReply.text).toBe('sender-response');
    expect(senderSend.action).toBe('deliver');
    expect(ownerSend.action).toBe('deliver');
    expect(owner.stderr).toBe('');
    expect(sender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(senderCode).toBe(0);

    let leftoverSockets: string[] = [];
    try {
      leftoverSockets = readdirSync(socketDir).filter(name => name.endsWith('.sock'));
    } catch {}
    expect(leftoverSockets).toEqual([]);
  }, 30_000);

  it('releases old ownership while delayed replies keep their captured thread destination', async () => {
    const owner = startChild('owner', resourceId, 'thread-transition');
    await owner.waitFor('thread-owned');

    const sender = startChild('sender', resourceId, 'thread-transition');
    await sender.waitFor('thread-owned');
    await sender.waitFor('request-send');
    const capturedRoute = await owner.waitFor('captured-route');

    sender.child.stdin.write('transition\n');
    const transitioned = await sender.waitFor('transitioned');
    owner.child.stdin.write('reply\n');

    const transitionDiscovery = await owner.waitFor('transition-discovery');
    const delayedSend = await owner.waitFor('delayed-send');
    const delayedReply = await sender.waitFor('delayed-reply');

    owner.child.stdin.write('close\n');
    sender.child.stdin.write('close\n');
    owner.child.stdin.end();
    sender.child.stdin.end();
    const [ownerCode, senderCode] = await Promise.all([owner.result, sender.result]);

    expect(capturedRoute.threadId).toBe('sender-thread');
    expect(transitioned).toMatchObject({ fromThreadId: 'sender-thread', threadId: 'sender-thread-2' });
    expect(transitionDiscovery).toMatchObject({ hasOldThread: false, hasNewThread: true });
    expect(delayedSend.targetThreadId).toBe('sender-thread');
    expect(delayedReply).toMatchObject({ threadId: 'sender-thread', text: 'owner-response' });
    expect(owner.stderr).toBe('');
    expect(sender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(senderCode).toBe(0);

    let leftoverSockets: string[] = [];
    try {
      leftoverSockets = readdirSync(socketDir).filter(name => name.endsWith('.sock'));
    } catch {}
    expect(leftoverSockets).toEqual([]);
  }, 30_000);
});
