import { createClient } from '@libsql/client/node';
import { BillingError } from '../../src/billing/contracts.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';

const storage = await OrganizationStorage.open({ url: process.argv[2] });
const service = new OrganizationService(storage, { mode: 'local', provider: 'local' });
process.send?.({ type: 'ready' });
process.on(
  'message',
  async (message: {
    round: number;
    action: 'accept' | 'member';
    credential: string;
    workspaceId: string;
    key: string;
    token?: string;
    memberId?: string;
    role?: 'owner' | 'admin' | 'member' | null;
  }) => {
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
      const context = await service.context({ credential: message.credential, workspaceId: message.workspaceId });
      if (message.action === 'accept') await service.accept(context, message.key, { token: message.token! });
      else await service.changeMember(context, message.key, { memberId: message.memberId!, role: message.role! });
      process.send?.({ type: 'result', round: message.round, status: 'accepted' });
    } catch (error) {
      process.send?.({
        type: 'result',
        round: message.round,
        status: error instanceof BillingError ? error.code : 'unexpected_error',
      });
    }
  },
);
