import { afterEach, describe, expect, it } from 'vitest';

import { SpannerStore } from '.';

// Runs without ENABLE_TESTS and without an emulator. Constructing a store must
// not make the Spanner client look up Application Default Credentials: in CI
// there are none, and the background rejection fails the whole vitest run.
describe('SpannerStore construction without an emulator', () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);

  afterEach(() => {
    process.off('unhandledRejection', onRejection);
  });

  it('does not trigger a default-credentials lookup', async () => {
    process.on('unhandledRejection', onRejection);

    const store = new SpannerStore({
      id: 'no-adc',
      projectId: 'p',
      instanceId: 'i',
      databaseId: 'd',
      spannerOptions: { servicePath: 'localhost', port: 9010, sslCreds: undefined },
    });

    // The ADC rejection lands about 1.5s after construction; give it ample time.
    await new Promise(resolve => setTimeout(resolve, 5_000));

    const messages = rejections.map(r => (r instanceof Error ? r.message : String(r)));
    expect(messages.filter(m => /default credentials/i.test(m))).toEqual([]);
    await store.close();
  }, 15_000);
});
