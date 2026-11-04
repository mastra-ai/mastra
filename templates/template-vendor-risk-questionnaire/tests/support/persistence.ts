import type { Client, Transaction } from '@libsql/client';
// Inject and observe only the published Client/Transaction surface; real database work is delegated.
export function controlledClient(client: Client, intercept: (method: string, args: unknown[]) => void | Promise<void>) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  function wrap<T extends Client | Transaction>(target: T, prefix = ''): T {
    return new Proxy(target, {
      get(object, key) {
        const value = Reflect.get(object, key, object);
        if (typeof value !== 'function') return value;
        if (key === 'close' || key === 'reconnect')
          return (...args: unknown[]) => {
            calls.push({ method: prefix + String(key), args });
            intercept(prefix + String(key), args);
            return value.apply(object, args);
          };
        return async (...args: unknown[]) => {
          const method = prefix + String(key);
          calls.push({ method, args });
          await intercept(method, args);
          const result = await value.apply(object, args);
          return key === 'transaction' ? wrap(result as Transaction, 'tx.') : result;
        };
      },
    });
  }
  return { client: wrap(client), calls };
}
