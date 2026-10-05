import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const peerResourceId = 'mc-e2e-peer-resource';
const peerThreadId = 'mc-e2e-peer-thread';
const peerId = `code-agent:${peerResourceId}:${peerThreadId}`;
const peerInstructions = 'A peer agent in another project used by the Mastra Code E2E harness.';
const signalText = 'Cross-project hello from the E2E project.';
const peerScript = fileURLToPath(new URL('./agent-connections-cross-project-peer.mjs', import.meta.url));

const requestSchema = z.object({
  body: z.object({
    messages: z.array(
      z.object({ role: z.string(), content: z.unknown().optional(), tool_call_id: z.string().optional() }),
    ),
  }),
});

type PeerModelCall = { url: string; status: number; body: string };

let socketRoot: string | undefined;
let peerWoken: Promise<PeerModelCall> | undefined;

function toolResult(requests: unknown[], toolCallId: string): string {
  for (const request of requests) {
    const parsed = requestSchema.safeParse(request);
    const result = parsed.success
      ? parsed.data.body.messages.find(message => message.role === 'tool' && message.tool_call_id === toolCallId)
      : undefined;
    if (result) return JSON.stringify(result.content);
  }
  throw new Error(`Missing tool result ${toolCallId}`);
}

function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function stopPeer(peer: ChildProcess): Promise<void> {
  if (peer.exitCode !== null || peer.signalCode !== null) return;
  const exited = new Promise<void>(resolve => peer.once('exit', () => resolve()));
  peer.stdin?.end();
  await waitWithTimeout(exited, 5_000, 'Peer did not exit').catch(() => {
    peer.kill('SIGKILL');
  });
}

export const agentConnectionsCrossProjectScenario = {
  name: 'agent-connections-cross-project',
  description:
    'Discover, connect to, and signal a peer running as a separate process in another project with cross-project discovery on.',
  testName: 'discovers and signals an agent running in another project',
  useOpenAIModel: true,
  aimockFixture: 'agent-connections-cross-project.json',
  env() {
    // A short root keeps socket paths under the macOS 104-byte limit and keeps
    // this run away from the real machine-wide /tmp/mc/_shared scope.
    socketRoot = mkdtempSync('/tmp/mcs-');
    return { MASTRACODE_SIGNALS_SOCKET_ROOT: socketRoot };
  },
  async inProcessApp({ startMastraCodeApp }) {
    const rootDir = socketRoot;
    if (!rootDir) throw new Error('Expected env() to create a socket root');
    // The runtime answers discovery once per process, so the peer in the other
    // project must be its own process to be discoverable.
    const peer = spawn(process.execPath, [peerScript, peerResourceId, peerThreadId, peerInstructions], {
      env: { ...process.env, MASTRACODE_SIGNALS_SOCKET_ROOT: rootDir },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let markReady!: () => void;
    let markWoken!: (call: PeerModelCall) => void;
    const ready = new Promise<void>(resolve => (markReady = resolve));
    peerWoken = new Promise(resolve => (markWoken = resolve));
    createInterface({ input: peer.stdout! }).on('line', line => {
      let event: { type?: string } & Partial<PeerModelCall>;
      try {
        event = JSON.parse(line);
      } catch {
        return; // Not one of the peer's events.
      }
      if (event.type === 'ready') markReady();
      if (event.type === 'model-call') {
        markWoken({ url: event.url ?? '', status: event.status ?? 0, body: event.body ?? '' });
      }
    });

    try {
      await waitWithTimeout(ready, 20_000, 'Peer in the other project never advertised its thread');
      const app = await startMastraCodeApp({
        config: {
          unixSocketPubSub: true,
          crossAgentSignals: true,
        },
      });
      return {
        stop: async () => {
          try {
            await app.stop?.();
          } finally {
            await stopPeer(peer);
            rmSync(rootDir, { recursive: true, force: true });
            socketRoot = undefined;
            peerWoken = undefined;
          }
        },
      };
    } catch (error) {
      await stopPeer(peer);
      rmSync(rootDir, { recursive: true, force: true });
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    terminal.submit('Find the peer reviewer in the other project and connect to it.');
    await runtime.waitForScreenText(/● agent_connections_list\b/i, terminal, 20_000);
    await runtime.waitForScreenText(/● agent_connect\b/i, terminal, 20_000);
    await runtime.waitForScreenText(/Cross-project peer connected/i, terminal, 20_000);

    terminal.submit('Send the cross-project peer a hello.');
    await runtime.waitForScreenText(/● agent_signal_send\b/i, terminal, 20_000);
    await runtime.waitForScreenText(/Cross-project hello sent/i, terminal, 20_000);
    if (!peerWoken) throw new Error('Expected the peer process to be running');
    // The peer's own model call proves the signal crossed resources and woke its thread.
    const peerCall = await waitWithTimeout(peerWoken, 20_000, 'Peer in the other project was never woken');
    expect(peerCall.body).toContain(peerInstructions);
    expect(peerCall.body).toContain(signalText);
    // The woken run itself succeeded: AIMock answered the peer's request.
    assert.equal(peerCall.status, 200, `Peer model call to ${peerCall.url} failed`);
    await expect(
      terminal.getByText(
        /agent_connections_list ✗|agent_connect .*✗|agent_signal_send .*✗|Failed to (list|connect|send)/i,
        {
          full: true,
          strict: false,
        },
      ),
    ).not.toBeVisible();
    runtime.printScreen('after cross-project flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    // A's own list must show the peer from the other resource namespace, not
    // just agent_connect's lookup.
    const listResult = toolResult(requests, 'call_cross_project_list');
    expect(listResult).toContain('[discovered]');
    expect(listResult).toContain(peerId);
    expect(toolResult(requests, 'call_cross_project_connect')).toContain(`Connected 1 agent: ${peerId}`);
    expect(toolResult(requests, 'call_cross_project_send')).toContain('Delivered high signal');
  },
} satisfies McE2eScenario;
