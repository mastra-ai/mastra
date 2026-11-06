import { createClient } from '@libsql/client/node';
import { BillingError } from '../../src/billing/contracts.js';
import { BillingGateway } from '../../src/billing/gateway.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { LocalBillingProvider } from '../../src/billing/providers/local.js';

const [url, serialized, credential, workspaceId] = process.argv.slice(2);
const configuration = JSON.parse(serialized);
const directory = await OrganizationStorage.open({ url });
const organizations = new OrganizationService(directory, { mode: 'local', provider: 'local' });
const commercial = await LocalBillingStorage.open({ url });
const provider = new LocalBillingProvider(commercial, configuration);
const storage = await AccountingStorage.open({ url }, directory);
let hang = false;
let round = 0;
const gateway = new BillingGateway(organizations, storage, provider, configuration, [
  {
    resourceId: 'assistant',
    operation: 'generate',
    measurements: [{ key: 'token-count', maxUnits: 10 }],
    execute: async () => {
      if (hang) {
        process.send?.({ type: 'executing', round });
        await new Promise(() => {});
      }
      return { status: 'succeeded', result: { text: 'worker result' }, measurementComplete: true, measurements: [] };
    },
  },
]);
const context = await organizations.context({ credential, workspaceId });
process.send?.({ type: 'ready' });
process.on('message', async (message: { type: string; round: number; key: string }) => {
  try {
    hang = message.type === 'hang';
    round = message.round;
    const probe = createClient({ url, intMode: 'bigint', concurrency: 1, timeout: 0 });
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
    process.send?.({ type: 'attempting', round, contended });
    const response = await gateway.execute(context, {
      resourceId: 'assistant',
      operation: 'generate',
      idempotencyKey: message.key,
      input: { prompt: 'hello' },
    });
    process.send?.({ type: 'result', round, status: response.billing.executionStatus });
  } catch (error) {
    process.send?.({
      type: 'result',
      round: message.round,
      status: error instanceof BillingError ? error.code : 'unexpected_error',
    });
  }
});
