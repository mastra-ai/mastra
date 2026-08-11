import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import type { Mastra } from '../mastra';
import { testUsage } from '../stream/aisdk/v5/test-utils';
import { loop } from './loop';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './test-utils/MastraLanguageModelV2Mock';
import { createTestMastra, mockDate } from './test-utils/utils';

/**
 * Prompt-identity regression test (instrumentation must never change prompt bytes).
 *
 * The fixture at __fixtures__/prompt-identity-baseline.json was captured by
 * running this file on the pristine base commit (upstream/main, before any
 * instrumentation changes) with CAPTURE_PROMPT_IDENTITY_BASELINE=1. The test
 * asserts the serialized prompt sent to the model is byte-identical to that
 * baseline.
 *
 * If this test fails, the default conclusion is that a change altered the bytes
 * sent to models — investigate before touching the fixture. Regenerating it is
 * legitimate ONLY when an upstream change intentionally altered prompt
 * assembly, in which case regenerate with:
 *
 *   CAPTURE_PROMPT_IDENTITY_BASELINE=1 vitest run src/loop/prompt-identity.test.ts
 *
 * and state the intentional prompt-assembly change in the commit message.
 *
 * Scope: this guards prompt BYTES, not the instrumentation. It passes whether
 * or not the region-attribution seam fires — that is covered by
 * agent/message-list/region-attribution.test.ts and by the span snapshots in
 * observability/mastra.
 */

const FIXTURE_PATH = join(__dirname, '__fixtures__', 'prompt-identity-baseline.json');
const CAPTURE = process.env.CAPTURE_PROMPT_IDENTITY_BASELINE === '1';

describe('prompt identity (loop-level)', () => {
  let mastraRef: { current?: Mastra } = {};
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(mockDate);
    const created = await createTestMastra();
    mastraRef.current = created.mastra;
    dispose = created.dispose;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await dispose?.();
    mastraRef.current = undefined;
    dispose = undefined;
  });

  it('sends a prompt byte-identical to the committed baseline', async () => {
    const messageList = new MessageList();
    messageList.addSystem('You are a test agent. Answer briefly.');
    messageList.addSystem('Remembered fact: the sky is blue.', 'memory');
    messageList.add(
      {
        id: 'msg-1',
        role: 'user',
        content: [{ type: 'text', text: 'What color is the sky?' }],
      },
      'input',
    );

    let capturedPrompt: unknown;
    const result = loop({
      methodType: 'stream',
      runId: 'prompt-identity-run',
      mastra: mastraRef.current as any,
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          model: new MockLanguageModelV2({
            doStream: async ({ prompt }) => {
              capturedPrompt = prompt;
              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Blue.' },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage: testUsage },
                ]),
              };
            },
          }),
        },
      ],
      messageList,
      agentId: 'agent-id',
    });

    expect(await result.text).toBe('Blue.');
    expect(capturedPrompt).toBeDefined();

    const serialized = JSON.stringify(capturedPrompt, null, 2) + '\n';

    if (CAPTURE) {
      mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
      writeFileSync(FIXTURE_PATH, serialized);
      // Capture mode only writes the baseline; identity is asserted on normal runs.
      return;
    }

    expect(existsSync(FIXTURE_PATH), `missing baseline fixture at ${FIXTURE_PATH}`).toBe(true);
    const baseline = readFileSync(FIXTURE_PATH, 'utf8');
    expect(serialized).toBe(baseline);
  });
});
