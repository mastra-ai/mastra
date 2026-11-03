import { describe, expect, it } from 'vitest';

import { noopLogger } from './index';

describe('noopLogger', () => {
  it('swallows log calls and reports an empty log page', async () => {
    expect(() => {
      noopLogger.debug('debug');
      noopLogger.info('info');
      noopLogger.warn('warn');
      noopLogger.error('error');
      noopLogger.trackException(new Error('boom'));
    }).not.toThrow();

    await expect(noopLogger.listLogs('transport')).resolves.toEqual({
      logs: [],
      total: 0,
      page: 1,
      perPage: 100,
      hasMore: false,
    });
  });
});
