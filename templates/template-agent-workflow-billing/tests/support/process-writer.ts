import { ipcWorker } from './ipc-worker.js';
import type { UsageEvent } from '../../src/billing/contracts/core.js';

interface Message {
  type: string;
  round?: number;
  status?: string;
  contended?: boolean;
}

export function processWriter(url: string) {
  const worker = ipcWorker<Message>(new URL('./billing-worker.mjs', import.meta.url), [url]);
  return { ...worker, claim: (round: number, event: UsageEvent) => worker.send({ type: 'claim', round, event }) };
}
