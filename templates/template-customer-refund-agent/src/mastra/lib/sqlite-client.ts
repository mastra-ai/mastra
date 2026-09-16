import {
  createClient,
  type Client,
  type Transaction,
  type TransactionMode,
} from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "./database-url";

const writeChains = new WeakMap<object, Promise<void>>();
const serializedClients = new WeakMap<Client, Client>();
let sharedLocalClient: Client | undefined;
let mastraSharedLocalClient: Client | undefined;

function ensureFileDatabaseParent(url: string) {
  if (!url.startsWith("file:") || url.includes(":memory:")) return;
  mkdirSync(dirname(fileURLToPath(url)), { recursive: true });
}

function isLockError(error: unknown) {
  const value = error as { code?: string; message?: string };
  return (
    value.code === "SQLITE_BUSY" ||
    value.code === "SQLITE_LOCKED" ||
    /database (is )?locked|database table is locked/i.test(value.message ?? "")
  );
}

async function retryBusy<T>(operation: () => Promise<T>) {
  let delay = 5;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isLockError(error) || attempt === 4) throw error;
      lastError = error;
      // The sqlite3 driver is synchronous. Yielding here lets the holder's
      // pending commit run instead of blocking the JavaScript event loop in a
      // native busy wait.
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw lastError;
}

async function acquireWriteLock(client: object) {
  const previous = writeChains.get(client) ?? Promise.resolve();
  let release!: () => void;
  const current = previous.then(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  writeChains.set(client, current);
  await previous;
  return release;
}

async function withWriteLock<T>(client: object, operation: () => Promise<T>) {
  const release = await acquireWriteLock(client);
  try {
    return await retryBusy(operation);
  } finally {
    release();
  }
}

function releaseWhenFinished(transaction: Transaction, release: () => void) {
  let finished = false;
  const unlock = () => {
    if (!finished) {
      finished = true;
      release();
    }
  };
  const finish = async (method: "commit" | "rollback") => {
    try {
      const result = await retryBusy(() => transaction[method]());
      unlock();
      return result;
    } catch (error) {
      // A failed commit can leave an open transaction. Keep the client queue
      // fenced until the caller rolls it back or closes it.
      if (method === "rollback") unlock();
      throw error;
    }
  };
  return new Proxy(transaction, {
    get(target, property) {
      if (property === "commit") return () => finish("commit");
      if (property === "rollback") return () => finish("rollback");
      if (property === "execute")
        return (...args: Parameters<Transaction["execute"]>) =>
          retryBusy(() =>
            Reflect.apply(transaction.execute, transaction, args),
          );
      if (property === "batch")
        return (...args: Parameters<Transaction["batch"]>) =>
          retryBusy(() => Reflect.apply(transaction.batch, transaction, args));
      if (property === "executeMultiple")
        return (...args: Parameters<Transaction["executeMultiple"]>) =>
          retryBusy(() =>
            Reflect.apply(transaction.executeMultiple, transaction, args),
          );
      if (property === "close")
        return () => {
          try {
            return target.close();
          } finally {
            unlock();
          }
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Serialize statements per libSQL client and retry lock conflicts
 * asynchronously. The installed libSQL client waits synchronously for a busy
 * database, which can otherwise prevent a pending transaction commit from
 * reaching the event loop.
 */
export function serializeSqliteClient(client: Client): Client {
  const existing = serializedClients.get(client);
  if (existing) return existing;
  let serialized!: Client;
  serialized = {
    get closed() {
      return client.closed;
    },
    protocol: client.protocol,
    execute: (...args) =>
      withWriteLock(
        serialized,
        () =>
          Reflect.apply(client.execute, client, args) as ReturnType<
            Client["execute"]
          >,
      ),
    batch: (...args) => withWriteLock(serialized, () => client.batch(...args)),
    executeMultiple: (sql) =>
      withWriteLock(serialized, () => client.executeMultiple(sql)),
    migrate: (...args) =>
      withWriteLock(serialized, () => client.migrate(...args)),
    transaction: async (mode: TransactionMode = "write") => {
      if (mode !== "write") return client.transaction(mode);
      const release = await acquireWriteLock(serialized);
      try {
        return releaseWhenFinished(
          await retryBusy(() => client.transaction("write")),
          release,
        );
      } catch (error) {
        release();
        throw error;
      }
    },
    sync: () => client.sync(),
    reconnect: () => client.reconnect(),
    close: () => client.close(),
  } as Client;
  serializedClients.set(client, serialized);
  return serialized;
}

/**
 * Mastra and the app's CaseStore use separate table families in one local
 * database. Giving them this one client makes every write enter the same
 * cooperative queue, including the lifetime of interactive transactions.
 */
export function getSharedLocalSqliteClient() {
  const url = resolveDatabaseUrl();
  ensureFileDatabaseParent(url);
  sharedLocalClient ??= serializeSqliteClient(
    createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      timeout: 0,
    }),
  );
  return sharedLocalClient;
}

/**
 * Mastra closes its storage before it flushes observability. Its storage
 * exporter uses the same app-owned SQLite client, so defer only that close
 * until the composition root has completed its shutdown sequence.
 */
export function getMastraSharedLocalSqliteClient() {
  if (mastraSharedLocalClient) return mastraSharedLocalClient;
  const client = getSharedLocalSqliteClient();
  mastraSharedLocalClient = new Proxy(client, {
    get(target, property, receiver) {
      if (property === "close") return async () => undefined;
      return Reflect.get(target, property, receiver);
    },
  });
  return mastraSharedLocalClient;
}

/** Close the client only after Mastra observability has finished flushing. */
export async function closeSharedLocalSqliteClient() {
  const client = sharedLocalClient;
  sharedLocalClient = undefined;
  mastraSharedLocalClient = undefined;
  if (client && !client.closed) await client.close();
}
