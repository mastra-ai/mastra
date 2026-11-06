import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { UsageEvent } from '../../src/billing/contracts.js';

interface Message {
  type: string;
  round?: number;
  status?: string;
  contended?: boolean;
}

export function processWriter(url: string) {
  const child = fork(fileURLToPath(new URL('./billing-worker.mjs', import.meta.url)), [url], {
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const inbox: Message[] = [];
  const waiters: {
    type: string;
    round?: number;
    resolve: (message: Message) => void;
    reject: (error: Error) => void;
  }[] = [];
  let stderr = '';
  let exited = false;
  child.stderr?.on('data', chunk => {
    stderr += String(chunk);
  });
  child.on('message', (message: Message) => {
    const index = waiters.findIndex(waiter => waiter.type === message.type && waiter.round === message.round);
    if (index === -1) inbox.push(message);
    else waiters.splice(index, 1)[0].resolve(message);
  });
  child.on('exit', code => {
    exited = true;
    for (const waiter of waiters.splice(0)) waiter.reject(new Error(`Billing writer exited (${code}): ${stderr}`));
  });
  return {
    claim: (round: number, event: UsageEvent) => child.send({ type: 'claim', round, event }),
    wait: (type: string, round?: number): Promise<Message> => {
      const index = inbox.findIndex(message => message.type === type && message.round === round);
      if (index !== -1) return Promise.resolve(inbox.splice(index, 1)[0]);
      if (exited) return Promise.reject(new Error(`Billing writer exited: ${stderr}`));
      return new Promise((resolve, reject) => waiters.push({ type, round, resolve, reject }));
    },
    close: () => {
      child.kill();
    },
  };
}
