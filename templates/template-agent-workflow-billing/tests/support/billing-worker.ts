import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { BillingError } from '../../src/billing/contracts.js';
import type { UsageEvent } from '../../src/billing/contracts.js';
import { createClient } from '@libsql/client/node';

const storage = await LocalBillingStorage.open({ url: process.argv[2] });
process.send?.({ type: 'ready' });
process.on('message', async (message: { type: string; round: number; event: UsageEvent }) => {
  if (message.type === 'close') {
    storage.close();
    process.disconnect();
    return;
  }
  try {
    const probe = createClient({ url: process.argv[2], intMode: 'bigint', concurrency: 1, timeout: 0 });
    let contended = false;
    try {
      const transaction = await probe.transaction('write');
      await transaction.rollback();
    } catch (error) {
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_BUSY')
        contended = true;
      else throw error;
    } finally {
      probe.close();
    }
    process.send?.({ type: 'attempting', round: message.round, contended });
    const result = await storage.reportUsage(message.event);
    process.send?.({ type: 'result', round: message.round, status: result.status });
  } catch (error) {
    process.send?.({
      type: 'result',
      round: message.round,
      status: error instanceof BillingError ? error.code : 'unexpected_error',
    });
  }
});
