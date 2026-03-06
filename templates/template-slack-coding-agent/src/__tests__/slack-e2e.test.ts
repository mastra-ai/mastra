/**
 * Simulated Slack E2E test using createMastraCode
 *
 * Tests the full pipeline: Slack webhook → Harness (MastraCode) → E2B sandbox → Slack API
 *
 * - Real: Anthropic API, E2B sandbox, MastraCode agent + tools
 * - Mocked: Slack WebClient (captures all API calls)
 * - Skipped if ANTHROPIC_API_KEY or E2B_API_KEY is not set
 */
import crypto from 'node:crypto';
import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { createMastraCode } from 'mastracode';
import { streamHarnessToSlack } from '../mastra/slack/harness-streaming.js';
import { verifySlackRequest } from '../mastra/slack/verify.js';

const hasKeys = !!(process.env.ANTHROPIC_API_KEY && process.env.E2B_API_KEY);

// ---------------------------------------------------------------------------
// Mock Slack WebClient
// ---------------------------------------------------------------------------

interface SlackCall {
  method: 'postMessage' | 'update';
  args: Record<string, unknown>;
  ts: number;
}

function createMockSlackClient() {
  const calls: SlackCall[] = [];
  let messageCounter = 0;

  const postMessage = vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
    const ts = `${Date.now()}.${++messageCounter}`;
    calls.push({ method: 'postMessage', args, ts: Date.now() });
    return { ok: true, ts, channel: args.channel };
  });

  const update = vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
    calls.push({ method: 'update', args, ts: Date.now() });
    return { ok: true, ts: args.ts, channel: args.channel };
  });

  const client = {
    chat: { postMessage, update },
  } as any;

  return { client, calls, postMessage, update };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeSlackSignature(signingSecret: string, timestamp: string, body: string): string {
  const sigBaseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(sigBaseString).digest('hex');
  return `v0=${hmac}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasKeys)('Slack E2E (simulated) — createMastraCode', () => {
  let sandbox: E2BSandbox;
  let harness: any;

  beforeAll(async () => {
    const t0 = Date.now();
    const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

    // Create a bare E2B sandbox
    console.log(`[${elapsed()}] Creating E2B sandbox...`);
    sandbox = new E2BSandbox({
      id: `slack-e2e-${Date.now()}`,
      timeout: 300_000,
    });

    const workspace = new Workspace({ sandbox });

    // Create MastraCode with E2B workspace override
    console.log(`[${elapsed()}] Creating MastraCode instance...`);
    const result = await createMastraCode({
      workspace,
      disableMcp: true,
      disableHooks: true,
      initialState: {
        projectPath: '/home/user',
      },
    });
    harness = result.harness;

    // Initialize harness (starts the sandbox)
    console.log(`[${elapsed()}] Initializing harness...`);
    await harness.init();

    // Wait for sandbox healthcheck
    console.log(`[${elapsed()}] Waiting for sandbox healthcheck...`);
    for (let i = 0; i < 30; i++) {
      try {
        const r = await sandbox.executeCommand!('echo ready');
        if (r?.exitCode === 0) {
          console.log(`[${elapsed()}] Sandbox healthy`);
          break;
        }
      } catch {
        // retry
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[${elapsed()}] Setup complete`);
  }, 120_000);

  afterAll(async () => {
    await sandbox._destroy().catch(() => {});
  }, 30_000);

  // =========================================================================
  // Test 1: Slack signature verification
  // =========================================================================
  it('verifies Slack request signatures', () => {
    const signingSecret = 'test-secret-123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"event_callback","event":{"type":"app_mention"}}';

    const signature = computeSlackSignature(signingSecret, timestamp, body);

    expect(verifySlackRequest(signingSecret, signature, timestamp, body)).toBe(true);
    expect(verifySlackRequest(signingSecret, 'v0=invalid', timestamp, body)).toBe(false);

    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const oldSig = computeSlackSignature(signingSecret, oldTimestamp, body);
    expect(verifySlackRequest(signingSecret, oldSig, oldTimestamp, body)).toBe(false);
  });

  // =========================================================================
  // Test 2: Full pipeline — MastraCode agent explores E2B sandbox
  // =========================================================================
  it('streams MastraCode agent responses to Slack via Harness events', async () => {
    const t0 = Date.now();
    const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

    const { client, calls, postMessage, update } = createMockSlackClient();

    console.log(`[${elapsed()}] Starting streamHarnessToSlack...`);

    const streamPromise = streamHarnessToSlack({
      slackClient: client,
      channel: 'C_TEST_CHANNEL',
      threadTs: '1234567890.000001',
      harness,
    });

    console.log(`[${elapsed()}] Sending message to agent...`);

    // Subscribe to events for progress logging
    harness.subscribe(event => {
      if (event.type === 'tool_start') {
        const args = JSON.stringify(event.args).slice(0, 100);
        console.log(`[${elapsed()}] tool_start: ${event.toolName}(${args})`);
      } else if (event.type === 'tool_end') {
        console.log(`[${elapsed()}] tool_end: ${event.toolCallId}`);
      } else if (event.type === 'agent_end') {
        console.log(`[${elapsed()}] agent_end`);
      }
    });

    await harness.sendMessage({
      content: 'Run: echo "Hello from MastraCode E2E" — then tell me what you see.',
    });

    console.log(`[${elapsed()}] Waiting for stream to finish...`);
    await streamPromise;
    console.log(`[${elapsed()}] Stream complete`);

    // --- Assertions ---

    // 1. Initial "thinking" message was posted
    const thinkingCall = calls.find(
      c => c.method === 'postMessage' && String(c.args.text).includes('Thinking'),
    );
    expect(thinkingCall).toBeDefined();
    console.log(`  ✓ Initial "Thinking..." message posted`);

    // 2. Progress updates
    const updateCalls = calls.filter(c => c.method === 'update');
    expect(updateCalls.length).toBeGreaterThan(0);
    console.log(`  ✓ ${updateCalls.length} progress update(s)`);

    // 3. Final response posted
    const responseCalls = calls.filter(
      c =>
        c.method === 'postMessage' &&
        !String(c.args.text).includes('Thinking') &&
        String(c.args.text).length > 10,
    );
    expect(responseCalls.length).toBeGreaterThanOrEqual(1);
    const responseText = String(responseCalls[0]?.args.text || '');
    console.log(`  ✓ Final response posted (${responseText.length} chars)`);
    console.log(`  Response preview: ${responseText.slice(0, 200)}...`);

    // 4. Status updated to "Done"
    const doneUpdate = calls.find(
      c => c.method === 'update' && String(c.args.text).includes('Done'),
    );
    expect(doneUpdate).toBeDefined();
    console.log(`  ✓ Status updated to "Done"`);

    // 5. Response references the echo output
    expect(responseText.toLowerCase()).toMatch(/hello|mastracode|e2e/i);
    console.log(`  ✓ Response content references echo output`);

    // 6. All Slack calls targeted the right channel
    for (const call of calls.filter(c => c.method === 'postMessage')) {
      expect(call.args.channel).toBe('C_TEST_CHANNEL');
    }
    console.log(`  ✓ All messages sent to correct channel`);

    console.log(`\n  Total Slack API calls: ${calls.length}`);
    console.log(`    postMessage: ${postMessage.mock.calls.length}`);
    console.log(`    update: ${update.mock.calls.length}`);
  }, 120_000);

  // =========================================================================
  // Test 3: Multi-turn conversation
  // =========================================================================
  it('handles sequential messages reusing the same Harness', async () => {
    const { client, calls } = createMockSlackClient();

    // First message
    const stream1 = streamHarnessToSlack({
      slackClient: client,
      channel: 'C_REUSE_TEST',
      threadTs: '9999.000001',
      harness,
    });
    await harness.sendMessage({ content: 'What is 2 + 2? Just say the number.' });
    await stream1;

    const firstCalls = calls.length;
    console.log(`  First message: ${firstCalls} Slack API calls`);

    // Second message
    const stream2 = streamHarnessToSlack({
      slackClient: client,
      channel: 'C_REUSE_TEST',
      threadTs: '9999.000001',
      harness,
    });
    await harness.sendMessage({ content: 'Now multiply that result by 10. Just say the number.' });
    await stream2;

    const secondCalls = calls.length - firstCalls;
    console.log(`  Second message: ${secondCalls} Slack API calls`);

    // Both rounds should have produced responses
    const responseMsgs = calls.filter(
      c =>
        c.method === 'postMessage' &&
        !String(c.args.text).includes('Thinking') &&
        String(c.args.text).length > 1,
    );
    expect(responseMsgs.length).toBeGreaterThanOrEqual(2);

    for (const msg of responseMsgs) {
      console.log(`  Response: ${String(msg.args.text).slice(0, 100)}`);
    }
  }, 120_000);
});
