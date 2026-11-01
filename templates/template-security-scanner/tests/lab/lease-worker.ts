import { InvestigationStore } from '../../src/investigation/store.js';
const [url] = process.argv.slice(2);
if (!url || !process.send) throw new Error('LEASE_WORKER_INPUT');
const store = new InvestigationStore(url);
await store.initialize();
process.send({ ready: true });
process.once('message', async message => {
  if (message !== 'claim') process.exit(1);
  const job = await store.claim('local-operator', 30000, 2, 1);
  process.send?.({ job: job ? { id: job.id, fence: job.fence, reservedRequests: job.reservedRequests } : null });
  setTimeout(() => process.exit(1), 15000);
});
