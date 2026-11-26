import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmod, link, lstat, mkdir, open, readFile, realpath, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { z } from 'zod';

const seedSchema = z.object({
  version: z.literal(1),
  users: z.tuple([
    z.object({ id: z.string().uuid(), key: z.string().min(40) }),
    z.object({ id: z.string().uuid(), key: z.string().min(40) }),
  ]),
});
export type ExampleSeed = z.infer<typeof seedSchema>;
export const keyVerifier = (key: string) => createHash('sha256').update(key, 'utf8').digest('hex');
/** Create and verify the private data directory used by the bundled example API. */
async function exampleHome(root: string) {
  const data = join(root, 'data');
  await mkdir(data, { mode: 0o700, recursive: true });
  const dataInfo = await lstat(data);
  if (!dataInfo.isDirectory() || dataInfo.isSymbolicLink() || dataInfo.uid !== process.getuid?.())
    throw new Error('EXAMPLE_DATA_UNSAFE');
  await chmod(data, 0o700);
  const home = join(root, 'data', 'example-target');
  await mkdir(home, { mode: 0o700, recursive: true });
  const info = await lstat(home);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.())
    throw new Error('EXAMPLE_DATA_UNSAFE');
  await chmod(home, 0o700);
  return home;
}
/** Acquire the example launch fence and return its asynchronous release function. */
export async function acquireExampleLaunchLock(root: string) {
  await exampleHome(root);
  const canonicalRoot = await realpath(root);
  const digest = createHash('sha256').update(canonicalRoot).digest();
  const port = 20_000 + (digest.readUInt32BE(0) % 20_000);
  const listener = createServer(socket => socket.destroy());
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => reject(error);
      listener.once('error', fail);
      listener.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
        listener.off('error', fail);
        resolve();
      });
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') throw new Error('EXAMPLE_INSTANCE_ACTIVE');
    throw new Error('EXAMPLE_LOCK_UNAVAILABLE');
  }
  return () =>
    new Promise<void>((resolve, reject) => {
      listener.close(error => (error ? reject(new Error('EXAMPLE_LOCK_RELEASE_FAILED')) : resolve()));
    });
}
/** Read the example seed only from a bounded, private file owned by the current user. */
async function readSeed(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o600)
    throw new Error('EXAMPLE_SEED_UNSAFE');
  return seedSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

/** Load or create the example accounts and order data under the protected data directory. */
export async function initializeExampleData(root: string): Promise<ExampleSeed> {
  const home = await exampleHome(root);
  const dbHome = join(home, 'db');
  await mkdir(dbHome, { mode: 0o700, recursive: true });
  const dbDirectoryInfo = await lstat(dbHome);
  if (!dbDirectoryInfo.isDirectory() || dbDirectoryInfo.isSymbolicLink() || dbDirectoryInfo.uid !== process.getuid?.())
    throw new Error('EXAMPLE_DATA_UNSAFE');
  await chmod(dbHome, 0o700);
  const seedPath = join(home, 'private-seed.json');
  let seed: ExampleSeed;
  try {
    seed = await readSeed(seedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    seed = {
      version: 1,
      users: [
        { id: randomUUID(), key: randomBytes(32).toString('base64url') },
        { id: randomUUID(), key: randomBytes(32).toString('base64url') },
      ],
    };
    const temporary = `${seedPath}.${randomUUID()}`;
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(seed));
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await link(temporary, seedPath);
    } catch (linkError) {
      if ((linkError as NodeJS.ErrnoException).code !== 'EEXIST') throw linkError;
      seed = await readSeed(seedPath);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const databasePath = join(dbHome, 'example.db');
  const db = createClient({ url: `file:${databasePath}` });
  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS example_users (id TEXT PRIMARY KEY, key_verifier TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS example_api_keys (
        key_verifier TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES example_users(id)
      );
      CREATE TABLE IF NOT EXISTS example_orders (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES example_users(id),
        description TEXT NOT NULL, amount_cents INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS example_products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL
      );
    `);
    await db.batch(
      [
        ...seed.users.map(user => ({
          sql: 'INSERT OR IGNORE INTO example_users (id, key_verifier) VALUES (?, ?)',
          args: [user.id, keyVerifier(user.key)],
        })),
        {
          sql: 'INSERT OR IGNORE INTO example_orders VALUES (?, ?, ?, ?)',
          args: ['ord-a-1001', seed.users[0].id, 'Private order A1', 12900],
        },
        {
          sql: 'INSERT OR IGNORE INTO example_orders VALUES (?, ?, ?, ?)',
          args: ['ord-a-1002', seed.users[0].id, 'Private order A2', 8900],
        },
        {
          sql: 'INSERT OR IGNORE INTO example_orders VALUES (?, ?, ?, ?)',
          args: ['ord-b-2001', seed.users[1].id, 'Private order B1', 17900],
        },
        { sql: 'INSERT OR IGNORE INTO example_products VALUES (?, ?, ?)', args: ['product-01', 'Notebook', 12900] },
        { sql: 'INSERT OR IGNORE INTO example_products VALUES (?, ?, ?)', args: ['product-02', 'Pen', 290] },
      ],
      'write',
    );
    await db.execute(
      'INSERT OR IGNORE INTO example_api_keys(key_verifier,user_id) SELECT key_verifier,id FROM example_users',
    );
    const users = await db.execute('SELECT id, key_verifier FROM example_users ORDER BY rowid');
    if (
      users.rows.length !== 2 ||
      seed.users.some(
        (user, index) => users.rows[index]?.id !== user.id || users.rows[index]?.key_verifier !== keyVerifier(user.key),
      )
    )
      throw new Error('EXAMPLE_SEED_DATABASE_MISMATCH');
  } finally {
    db.close();
  }
  const dbInfo = await stat(databasePath);
  if (!dbInfo.isFile() || dbInfo.uid !== process.getuid?.()) throw new Error('EXAMPLE_DATABASE_UNSAFE');
  await chmod(databasePath, 0o600);
  return seed;
}
