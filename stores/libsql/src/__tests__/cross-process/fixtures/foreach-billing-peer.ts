/**
 * Peer fixture for foreach-billing-restart.test.ts: the process that starts the billing
 * run and is SIGKILLed partway through. Customers 0 and 1 are charged; every later
 * charge hangs until the kill. Each completed charge is appended to the shared log.
 */
import { appendFileSync } from 'node:fs';

import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { createBillingWorkflow } from './foreach-billing-workflow';

export interface BillingPeerArgs {
  concurrency: number;
  logPath: string;
}

runPeer<BillingPeerArgs>(async peer => {
  const { concurrency, logPath } = peer.args;
  const storage = new LibSQLStore({ id: `foreach-billing-peer-${process.pid}`, url: peer.dbUrl });
  const workflow = createBillingWorkflow(concurrency, async customer => {
    if (customer >= 2) await new Promise(() => {});
    appendFileSync(logPath, `A ${customer}\n`);
    await peer.signal(`charged-${customer}`);
  });
  const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });

  const run = await mastra.getWorkflow('workflow').createRun();
  await run.start({ inputData: [0, 1, 2, 3, 4] });
  return {};
});
