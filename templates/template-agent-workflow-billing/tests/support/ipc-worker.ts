import { fork } from 'node:child_process';

export interface IpcMessage {
  type: string;
  round?: number;
}
/** Route worker replies by operation/round and release the process before its database. */
export function ipcWorker<Message extends IpcMessage>(script: string | URL, args: string[]) {
  const child = fork(script, args, { execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const inbox: Message[] = [];
  const waiters: {
    type: string;
    round?: number;
    resolve: (message: Message) => void;
    reject: (error: Error) => void;
  }[] = [];
  let stderr = '';
  let failure: Error | undefined;
  let exited = false;
  const fail = (error: Error) => {
    failure ??= error;
    for (const waiter of waiters.splice(0)) waiter.reject(failure);
  };
  const closed = new Promise<void>(resolve => {
    child.once('close', () => resolve());
  });
  child.stderr?.on('data', chunk => {
    stderr = (stderr + String(chunk)).slice(-32000);
  });
  child.on('error', fail);
  child.on('message', (message: Message) => {
    const index = waiters.findIndex(waiter => waiter.type === message.type && waiter.round === message.round);
    if (index === -1) inbox.push(message);
    else waiters.splice(index, 1)[0].resolve(message);
  });
  child.on('exit', (code, signal) => {
    exited = true;
    fail(new Error(`IPC worker exited (${signal ?? code}): ${stderr}`));
  });
  return {
    send: (message: object) => {
      if (failure) throw failure;
      child.send(message, error => {
        if (error) fail(error);
      });
    },
    wait: (type: string, round?: number): Promise<Message> => {
      const index = inbox.findIndex(message => message.type === type && message.round === round);
      if (index !== -1) return Promise.resolve(inbox.splice(index, 1)[0]);
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => waiters.push({ type, round, resolve, reject }));
    },
    close: async () => {
      if (!exited) child.kill();
      await closed;
    },
  };
}
