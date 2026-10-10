import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRunFencingTests } from '../../../_test-utils/src/domains/run-fencing';
import { ValkeyStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('Valkey run fencing', () => {
  const store = new ValkeyStore({
    id: 'valkey-run-fencing',
    host: 'localhost',
    port: 6382,
    password: 'valkey_password',
  });

  beforeAll(() => store.init());
  afterAll(() => store.close());

  it('declares fencing', async () => {
    expect((await store.getStore('workflows'))?.supportsRunFencing()).toBe(true);
    expect((await store.getStore('memory'))?.supportsRunFencing()).toBe(true);
  });

  createRunFencingTests({ storage: store });
});
