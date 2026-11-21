import { afterEach, describe, expect, it, vi } from 'vitest';

import { testConfig } from '../storage/test-utils';
import { SurrealDBConnector } from './connector';

describe('SurrealDBConnector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('closes the connection it opened when selecting the database fails, then reconnects', async () => {
    const connector = new SurrealDBConnector(testConfig('connector_retry'));
    vi.spyOn(connector.db, 'use').mockRejectedValueOnce(new Error('use failed'));
    const close = vi.spyOn(connector.db, 'close');

    await expect(connector.connect()).rejects.toThrow('use failed');
    expect(close).toHaveBeenCalledTimes(1);

    await connector.connect();
    const [result] = await connector.query<[number]>('RETURN 1');
    expect(result).toBe(1);
    await connector.close();
  });
});
