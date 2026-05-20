import { describe, it, expect, afterEach } from 'vitest';
import { NovaSonicVoice } from './index';

/**
 * End-to-end integration test against real AWS Bedrock Nova 2 Sonic.
 *
 * Excluded from the default vitest config so it never runs in CI. To run it
 * locally against real AWS Bedrock:
 *
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *   AWS_REGION=us-east-1 \
 *   pnpm --filter @mastra/voice-aws-nova-sonic test:e2e
 *
 * The `test:e2e` script sets `RUN_AWS_NOVA_SONIC_E2E=1` and points vitest at
 * `vitest.e2e.config.ts`, which only includes `*.e2e.test.ts` files.
 *
 * The test only exercises the connect / handshake path (no audio is sent),
 * which is enough to validate credentials, region routing, the bidirectional
 * stream wiring, and the initial sessionStart / promptStart / SYSTEM
 * content-block sequence built by `enqueueInitialSessionEvents`.
 */
const hasAwsCreds =
  Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) || Boolean(process.env.AWS_PROFILE);
const e2eEnabled = process.env.RUN_AWS_NOVA_SONIC_E2E === '1' && hasAwsCreds;

describe('NovaSonicVoice (e2e)', () => {
  let voice: NovaSonicVoice | undefined;

  afterEach(() => {
    if (voice) {
      try {
        voice.close();
      } catch {
        // ignore teardown errors
      }
      voice = undefined;
    }
  });

  it.skipIf(!e2eEnabled)(
    'connects to AWS Bedrock Nova 2 Sonic and reaches the connected state',
    { timeout: 30_000 },
    async () => {
      voice = new NovaSonicVoice({
        region: (process.env.AWS_REGION as 'us-east-1' | 'us-west-2' | 'ap-northeast-1') || 'us-east-1',
        speaker: 'matthew',
        debug: false,
      });

      await voice.connect();
      const listener = await voice.getListener();
      expect(listener.enabled).toBe(true);
    },
  );

  it.skipIf(!e2eEnabled)('lists the documented speakers without requiring a connection', async () => {
    voice = new NovaSonicVoice({});
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThanOrEqual(18);
    expect(speakers.find(s => s.voiceId === 'matthew')).toBeDefined();
    expect(speakers.find(s => s.voiceId === 'tiffany')).toBeDefined();
  });
});
