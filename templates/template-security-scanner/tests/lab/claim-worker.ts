import { z } from 'zod';
import { InvestigationStore } from '../../src/investigation/store.js';

const [url, owner, leaseText] = process.argv.slice(2);
if (!url || !owner || !process.send) throw new Error('CLAIM_WORKER_INPUT_REQUIRED');
const store = new InvestigationStore(url);
await store.initialize();
process.send({ ready: true });
process.once('message', async value => {
  try {
    if (value !== 'claim') {
      const request = z
        .object({
          operation: z.literal('resource-snapshot'),
          id: z.string().uuid(),
          targetId: z.string().uuid(),
          category: z.string().max(80),
          path: z.string().max(2048),
        })
        .strict()
        .parse(value);
      process.send?.({
        resources: {
          historical: await store.getOwnedResource(request.id, owner),
          current: await store.ownedResource(owner, request.targetId, request.category, request.path),
        },
      });
      return;
    }
    let job;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        job = await store.claim(owner, Number(leaseText ?? '5000'), 2, 1);
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_BUSY' || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
    process.send?.({ job: job ? { id: job.id, fence: job.fence, reservedRequests: job.reservedRequests } : null });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    process.send?.({ error: typeof code === 'string' ? code : error instanceof Error ? error.name : 'UNKNOWN' });
  } finally {
    await store.close();
    process.disconnect();
  }
});
